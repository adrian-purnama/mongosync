import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Decimal128, Long, MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getCopyJob, resetCopyJobRuntimeForTests } from "@/src/server/mongo/copy-job-store";
import {
  getExportArtifactFilePath,
} from "@/src/server/mongo/export/stream-export";
import { startExportJob, startImportJob } from "@/src/server/mongo/export-service";
import { resetInProcessLocksForTests } from "@/src/server/mongo/lock/job-lock";
import { encryptSecret } from "@/src/server/security/encryption-service";
import { saveAppData } from "@/src/server/storage/config-store";

const PASSWORD = "master-password";

describe("export/import integration", () => {
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
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-exp-int-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;
    resetCopyJobRuntimeForTests();
    resetInProcessLocksForTests();

    const client = new MongoClient(uri);
    await client.connect();
    try {
      await client.db("export_source").dropDatabase();
      await client.db("import_target").dropDatabase();
      await client.db("export_source").collection("typed").insertOne({
        _id: new ObjectId("507f1f77bcf86cd799439011"),
        when: new Date("2024-06-01T12:00:00.000Z"),
        amount: Decimal128.fromString("99.99"),
        count: Long.fromNumber(42),
      });
      await client
        .db("export_source")
        .collection("typed")
        .createIndex({ when: 1 }, { name: "when_1" });
    } finally {
      await client.close();
    }

    await saveAppData({
      version: 1,
      user: { masterPasswordHash: "hash", createdAt: new Date().toISOString() },
      organizations: [{ id: "org-1", name: "Org", createdAt: new Date().toISOString() }],
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
          environment: "local",
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

  it("round-trips ObjectId/Date/Decimal128/Long and indexes via ZIP", async () => {
    const exportJob = await startExportJob({
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      sourceDatabase: "export_source",
      sourceCollections: ["typed"],
      password: PASSWORD,
    });
    const exported = await waitForJob(exportJob!.id);
    expect(exported.status).toBe("completed");

    const zipPath = getExportArtifactFilePath(exported.id);
    const importJob = await startImportJob({
      organizationId: "org-1",
      targetConnectionId: "target-1",
      targetDatabase: "import_target",
      password: PASSWORD,
      filePath: zipPath,
    });
    const imported = await waitForJob(importJob!.id);
    expect(imported.status).toBe("completed");

    const client = new MongoClient(uri);
    await client.connect();
    try {
      const doc = await client.db("import_target").collection("typed").findOne({});
      expect(doc?._id).toBeInstanceOf(ObjectId);
      expect(doc?.when).toBeInstanceOf(Date);
      expect(doc?.amount).toBeInstanceOf(Decimal128);
      // Long may deserialize as number for values in the safe integer range.
      expect(
        doc?.count instanceof Long || typeof doc?.count === "number",
      ).toBe(true);
      expect(Number(doc?.count)).toBe(42);
      const indexes = await client.db("import_target").collection("typed").indexes();
      expect(indexes.some((index) => index.name === "when_1")).toBe(true);
    } finally {
      await client.close();
    }
  }, 180_000);
});

async function waitForJob(jobId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    const job = await getCopyJob(jobId);
    if (
      job &&
      (job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled")
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}
