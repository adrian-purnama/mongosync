import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadPersistedJobArtifact } from "@/src/server/jobs/job-store";
import {
  getCopyJob,
  requestCopyJobCancellation,
  resetCopyJobRuntimeForTests,
} from "@/src/server/mongo/copy-job-store";
import { encryptSecret } from "@/src/server/security/encryption-service";
import { saveAppData } from "@/src/server/storage/config-store";
import { exportDatabaseAsZipJson, startExportJob } from "@/src/server/mongo/export-service";

const { mockedCreateMongoClient } = vi.hoisted(() => ({
  mockedCreateMongoClient: vi.fn(),
}));

vi.mock("@/src/server/mongo/mongo-client-factory", () => ({
  createMongoClient: mockedCreateMongoClient,
}));

describe("export service", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-export-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;
    mockedCreateMongoClient.mockReset();
    resetCopyJobRuntimeForTests();

    await saveAppData({
      version: 1,
      user: {
        masterPasswordHash: "hash",
        createdAt: new Date().toISOString(),
      },
      organizations: [
        {
          id: "org-1",
          name: "Org 1",
          createdAt: new Date().toISOString(),
        },
      ],
      connections: [
        {
          id: "conn-1",
          name: "Source",
          encryptedMongoUrl: encryptSecret(
            "mongodb://localhost:27017/source-db",
            "master-password",
          ),
          locked: false,
          organizationId: "org-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(async () => {
    resetCopyJobRuntimeForTests();
    delete process.env.MONGOSYNC_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("exports only the selected collections as zip json", async () => {
    mockedCreateMongoClient.mockResolvedValue({
      db: () => ({
        collection: (name: string) => ({
          countDocuments: async () => 1,
          find: () => ({
            toArray: async () =>
              name === "users"
                ? [{ _id: { _bsontype: "ObjectId", toHexString: () => "abc123" }, name: "Ada" }]
                : [{ _id: 2, total: 4 }],
          }),
        }),
      }),
      close: async () => undefined,
    });

    const result = await exportDatabaseAsZipJson({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      sourceCollections: ["users", "orders"],
      password: "master-password",
    });

    const zip = await JSZip.loadAsync(result.content);
    const fileNames = Object.keys(zip.files).sort();
    const usersJson = await zip.file("users.json")?.async("string");
    const ordersJson = await zip.file("orders.json")?.async("string");

    expect(result.fileName).toBe("source-db.zip");
    expect(fileNames).toEqual(["orders.json", "users.json"]);
    expect(usersJson).toContain('"abc123"');
    expect(ordersJson).toContain('"total": 4');
  });

  it("exports the whole database when no collections are selected", async () => {
    mockedCreateMongoClient.mockResolvedValue({
      db: () => ({
        listCollections: () => ({
          toArray: async () => [{ name: "users" }, { name: "logs" }],
        }),
        collection: (name: string) => ({
          countDocuments: async () => 1,
          find: () => ({
            toArray: async () => [{ name, exported: true }],
          }),
        }),
      }),
      close: async () => undefined,
    });

    const result = await exportDatabaseAsZipJson({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      password: "master-password",
    });

    const zip = await JSZip.loadAsync(result.content);
    const fileNames = Object.keys(zip.files).sort();

    expect(fileNames).toEqual(["logs.json", "users.json"]);
  });

  it("rejects export when the connection belongs to a different organization", async () => {
    await expect(
      exportDatabaseAsZipJson({
        organizationId: "org-2",
        sourceConnectionId: "conn-1",
        sourceDatabase: "source-db",
        password: "master-password",
      }),
    ).rejects.toThrow("Connection must belong to the selected organization.");
  });

  it("persists a completed export job and its artifact", async () => {
    mockedCreateMongoClient.mockResolvedValue({
      db: () => ({
        listCollections: () => ({
          toArray: async () => [{ name: "users" }],
        }),
        collection: () => ({
          countDocuments: async () => 2,
          find: () => ({
            toArray: async () => [{ name: "Ada" }, { name: "Grace" }],
          }),
        }),
      }),
      close: async () => undefined,
    });

    const job = await startExportJob({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      password: "master-password",
    });

    const completedJob = await waitForJob(job?.id ?? "");
    const artifact = await loadPersistedJobArtifact(completedJob.id);
    const zip = await JSZip.loadAsync(artifact);

    expect(completedJob.kind).toBe("export");
    expect(completedJob.status).toBe("completed");
    expect(completedJob.resultAvailable).toBe(true);
    expect(completedJob.artifactFileName).toBe("source-db.zip");
    expect(Object.keys(zip.files)).toEqual(["users.json"]);
  });

  it("cancels an export job safely after cancellation is requested", async () => {
    let releaseCountDocuments: (() => void) | null = null;

    mockedCreateMongoClient.mockResolvedValue({
      db: () => ({
        listCollections: () => ({
          toArray: async () => [{ name: "users" }, { name: "logs" }],
        }),
        collection: (name: string) => ({
          countDocuments: async () => {
            if (name === "users") {
              return await new Promise<number>((resolve) => {
                releaseCountDocuments = () => resolve(1);
              });
            }

            return 1;
          },
          find: () => ({
            toArray: async () => [{ name: `${name}-document` }],
          }),
        }),
      }),
      close: async () => undefined,
    });

    const job = await startExportJob({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      password: "master-password",
    });

    await waitForCondition(async () => {
      const current = await getCopyJob(job?.id ?? "");
      return current?.status === "running";
    });

    await requestCopyJobCancellation(job?.id ?? "");
    releaseCountDocuments?.();

    const cancelledJob = await waitForJob(job?.id ?? "");

    expect(cancelledJob.status).toBe("cancelled");
    expect(cancelledJob.interruptedReason).toBe("user_cancelled");
    expect(cancelledJob.resultAvailable).toBe(false);
  });
});

async function waitForJob(jobId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const job = await getCopyJob(jobId);

    if (
      job &&
      (job.status === "completed" || job.status === "failed" || job.status === "cancelled")
    ) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for job ${jobId}.`);
}

async function waitForCondition(predicate: () => Promise<boolean>) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("Timed out waiting for condition.");
}
