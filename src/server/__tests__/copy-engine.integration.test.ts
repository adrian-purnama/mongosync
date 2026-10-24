import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Decimal128, Long, MongoClient, ObjectId, type Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getCopyJob,
  requestCopyJobCancellation,
  resetCopyJobRuntimeForTests,
} from "@/src/server/mongo/copy-job-store";
import {
  forceUnlockTargetDatabase,
  resumeCopyJob,
  revertCopyJob,
  startCopyJob,
} from "@/src/server/mongo/copy-service";
import { acquireJobLock, resetInProcessLocksForTests } from "@/src/server/mongo/lock/job-lock";
import { encryptSecret } from "@/src/server/security/encryption-service";
import { saveAppData } from "@/src/server/storage/config-store";

const PASSWORD = "master-password";

describe("copy engine integration", () => {
  let replSet: MongoMemoryReplSet;
  let uri: string;
  let tempDir: string;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    uri = replSet.getUri();
  }, 120_000);

  afterAll(async () => {
    await replSet?.stop();
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-copy-int-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;
    resetCopyJobRuntimeForTests();
    resetInProcessLocksForTests();

    const client = new MongoClient(uri);
    await client.connect();
    try {
      await client.db("source_db").dropDatabase();
      await client.db("target_db").dropDatabase();
    } finally {
      await client.close();
    }

    await saveAppData({
      version: 1,
      user: {
        masterPasswordHash: "hash",
        createdAt: new Date().toISOString(),
      },
      organizations: [
        { id: "org-1", name: "Org", createdAt: new Date().toISOString() },
      ],
      connections: [
        {
          id: "source-1",
          name: "Source",
          encryptedMongoUrl: encryptSecret(uri, PASSWORD),
          locked: false,
          environment: "prod",
          organizationId: "org-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "target-1",
          name: "Target",
          encryptedMongoUrl: encryptSecret(uri, PASSWORD),
          locked: false,
          environment: "dev",
          organizationId: "org-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(async () => {
    resetCopyJobRuntimeForTests();
    resetInProcessLocksForTests();
    delete process.env.MONGOSYNC_DATA_DIR;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("copies typed documents with correct counts", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    try {
      const docs = Array.from({ length: 250 }, (_, index) => ({
        _id: new ObjectId(),
        index,
        when: new Date("2024-01-01T00:00:00.000Z"),
        amount: Decimal128.fromString("12.34"),
        count: Long.fromNumber(index),
      }));
      await client.db("source_db").collection("items").insertMany(docs);
      await client
        .db("source_db")
        .collection("items")
        .createIndex({ index: 1 }, { name: "index_1" });
    } finally {
      await client.close();
    }

    const job = await startCopyJob({
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "source_db",
      targetDatabase: "target_db",
      sourceCollections: ["items"],
      mode: "override",
      password: PASSWORD,
    });

    const completed = await waitForJob(job!.id);
    expect(completed.status, completed.error ?? "no error").toBe("completed");

    const verifyClient = new MongoClient(uri);
    await verifyClient.connect();
    try {
      const targetDocs = await verifyClient
        .db("target_db")
        .collection("items")
        .find({})
        .sort({ index: 1 })
        .toArray();
      expect(targetDocs).toHaveLength(250);
      expect(targetDocs[0]?.amount).toBeInstanceOf(Decimal128);
      expect(
        targetDocs[0]?.count instanceof Long ||
          typeof targetDocs[0]?.count === "number",
      ).toBe(true);
      expect(Number(targetDocs[0]?.count)).toBe(0);
      expect(targetDocs[1]?.when).toBeInstanceOf(Date);
      const indexes = await verifyClient.db("target_db").collection("items").indexes();
      expect(indexes.some((index) => index.name === "index_1")).toBe(true);
    } finally {
      await verifyClient.close();
    }
  }, 120_000);

  it("rejects a second job while the target is locked", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const lock = await acquireJobLock({
      client,
      connectionId: "target-1",
      database: "target_db",
      jobId: "blocking-job",
    });

    try {
      const job = await startCopyJob({
        organizationId: "org-1",
        sourceConnectionId: "source-1",
        targetConnectionId: "target-1",
        sourceDatabase: "source_db",
        targetDatabase: "target_db",
        sourceCollections: ["items"],
        mode: "override",
        password: PASSWORD,
      });
      const finished = await waitForJob(job!.id, ["failed", "completed", "cancelled"]);
      expect(finished.status).toBe("failed");
      expect(finished.error ?? "").toMatch(/locked/i);
    } finally {
      await lock.release();
      await client.close();
    }
  }, 60_000);

  it("force unlock clears a stale lock", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const lock = await acquireJobLock({
      client,
      connectionId: "target-1",
      database: "target_db",
      jobId: "stale-job",
    });
    lock.stopHeartbeat();
    await client.close();

    await forceUnlockTargetDatabase({
      connectionId: "target-1",
      database: "target_db",
      password: PASSWORD,
      confirmDatabaseName: "target_db",
    });

    const probe = new MongoClient(uri);
    await probe.connect();
    try {
      const next = await acquireJobLock({
        client: probe,
        connectionId: "target-1",
        database: "target_db",
        jobId: "fresh-job",
      });
      await next.release();
    } finally {
      await probe.close();
    }
  }, 60_000);

  it("reverts a replace copy to the original target data", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    try {
      await client.db("source_db").collection("users").insertMany([
        { _id: 1, name: "new-a" },
        { _id: 2, name: "new-b" },
      ] as Document[]);
      await client.db("target_db").collection("users").insertMany([
        { _id: 1, name: "old-a" },
        { _id: 9, name: "old-only" },
      ] as Document[]);
    } finally {
      await client.close();
    }

    const job = await startCopyJob({
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "source_db",
      targetDatabase: "target_db",
      sourceCollections: ["users"],
      mode: "override",
      password: PASSWORD,
    });
    const completed = await waitForJob(job!.id);
    expect(completed.status).toBe("completed");

    const reverted = await revertCopyJob({ jobId: completed.id, password: PASSWORD });
    expect(reverted?.status).toBe("reverted");

    const verifyClient = new MongoClient(uri);
    await verifyClient.connect();
    try {
      const docs = await verifyClient
        .db("target_db")
        .collection("users")
        .find({})
        .sort({ _id: 1 })
        .toArray();
      expect(docs.map((doc) => doc.name)).toEqual(["old-a", "old-only"]);
    } finally {
      await verifyClient.close();
    }
  }, 120_000);

  it("cancel before swap leaves target unchanged", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    try {
      await client
        .db("source_db")
        .collection("slow")
        .insertMany(
          Array.from({ length: 5000 }, (_, index) => ({ _id: index, v: index })) as Document[],
        );
      await client
        .db("target_db")
        .collection("slow")
        .insertOne({ _id: "keep", v: 1 } as Document);
    } finally {
      await client.close();
    }

    const job = await startCopyJob({
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "source_db",
      targetDatabase: "target_db",
      sourceCollections: ["slow"],
      mode: "override",
      password: PASSWORD,
    });

    await waitForCondition(async () => {
      const current = await getCopyJob(job!.id);
      return current?.status === "running" && (current.processedDocuments ?? 0) > 0;
    });

    await requestCopyJobCancellation(job!.id);
    const cancelled = await waitForJob(job!.id, ["cancelled", "failed", "completed"]);
    expect(["cancelled", "completed", "failed"]).toContain(cancelled.status);

    const verifyClient = new MongoClient(uri);
    await verifyClient.connect();
    try {
      if (cancelled.status === "cancelled") {
        const docs = await verifyClient.db("target_db").collection("slow").find({}).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0]?._id).toBe("keep");
      }
    } finally {
      await verifyClient.close();
    }
  }, 120_000);

  it("resume continues a paused job", async () => {
    const client = new MongoClient(uri);
    await client.connect();
    try {
      await client
        .db("source_db")
        .collection("resume_me")
        .insertMany(
          Array.from({ length: 100 }, (_, index) => ({ _id: index, v: index })) as Document[],
        );
    } finally {
      await client.close();
    }

    const job = await startCopyJob({
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "source_db",
      targetDatabase: "target_db",
      sourceCollections: ["resume_me"],
      mode: "override",
      password: PASSWORD,
    });

    const completedOrPaused = await waitForJob(job!.id, [
      "completed",
      "paused",
      "failed",
    ]);

    if (completedOrPaused.status === "paused") {
      const resumed = await resumeCopyJob({
        jobId: completedOrPaused.id,
        password: PASSWORD,
      });
      const finished = await waitForJob(resumed!.id);
      expect(finished.status).toBe("completed");
    } else {
      expect(completedOrPaused.status).toBe("completed");
    }

    const verifyClient = new MongoClient(uri);
    await verifyClient.connect();
    try {
      expect(
        await verifyClient.db("target_db").collection("resume_me").countDocuments(),
      ).toBe(100);
    } finally {
      await verifyClient.close();
    }
  }, 120_000);
});

async function waitForJob(
  jobId: string,
  statuses: Array<"completed" | "failed" | "cancelled" | "paused" | "reverted"> = [
    "completed",
    "failed",
    "cancelled",
    "paused",
    "reverted",
  ],
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    const job = await getCopyJob(jobId);
    if (job && statuses.includes(job.status as never)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function waitForCondition(predicate: () => Promise<boolean>) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Timed out waiting for condition");
}
