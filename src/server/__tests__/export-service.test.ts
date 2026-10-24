import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCopyJob,
  requestCopyJobCancellation,
  resetCopyJobRuntimeForTests,
} from "@/src/server/mongo/copy-job-store";
import { loadExportArtifact, startExportJob } from "@/src/server/mongo/export-service";
import { encryptSecret } from "@/src/server/security/encryption-service";
import { saveAppData } from "@/src/server/storage/config-store";

const { mockedCreateMongoClient } = vi.hoisted(() => ({
  mockedCreateMongoClient: vi.fn(),
}));

vi.mock("@/src/server/mongo/mongo-client-factory", () => ({
  createMongoClient: mockedCreateMongoClient,
}));

function createAsyncCursor(documents: Record<string, unknown>[]) {
  return {
    sort() {
      return this;
    },
    batchSize() {
      return this;
    },
    limit() {
      return this;
    },
    async *[Symbol.asyncIterator]() {
      for (const document of documents) {
        yield document;
      }
    },
    close: async () => undefined,
    toArray: async () => documents,
  };
}

function createExportClientMock(collections: Record<string, Record<string, unknown>[]>) {
  return {
    db: () => ({
      listCollections: (filter?: { name?: string }) => ({
        toArray: async () => {
          const names = Object.keys(collections);
          if (filter?.name) {
            return names
              .filter((name) => name === filter.name)
              .map((name) => ({ name, options: {} }));
          }
          return names.map((name) => ({ name }));
        },
      }),
      collection: (name: string) => ({
        estimatedDocumentCount: async () => collections[name]?.length ?? 0,
        countDocuments: async () => collections[name]?.length ?? 0,
        listIndexes: () => ({
          toArray: async () => [{ name: "_id_", key: { _id: 1 } }],
        }),
        find: () => createAsyncCursor(collections[name] ?? []),
        aggregate: () => ({
          toArray: async () => (collections[name] ?? []).slice(0, 1),
        }),
      }),
      command: async () => ({ size: 0 }),
    }),
    close: async () => undefined,
  };
}

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
    delete process.env.MONGOSYNC_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists a completed streaming export job and its artifact", async () => {
    mockedCreateMongoClient.mockResolvedValue(
      createExportClientMock({
        users: [{ _id: "1", name: "Ada" }],
        orders: [{ _id: "2", total: 4 }],
      }),
    );

    const job = await startExportJob({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      sourceCollections: ["users", "orders"],
      password: "master-password",
    });

    const completedJob = await waitForJob(job?.id ?? "");
    expect(completedJob.status, completedJob.error ?? "no error").toBe("completed");
    expect(completedJob.resultAvailable).toBe(true);
    const artifact = await loadExportArtifact(completedJob.id);
    const zip = await JSZip.loadAsync(artifact.content);

    expect(completedJob.kind).toBe("export");
    expect(completedJob.artifactFileName).toBe("source-db.zip");
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "orders/data.ndjson",
        "orders/metadata.json",
        "users/data.ndjson",
        "users/metadata.json",
      ]),
    );

    const usersNdjson = await zip.file("users/data.ndjson")?.async("string");
    expect(usersNdjson).toContain("Ada");
  });

  it("exports the whole database when no collections are selected", async () => {
    mockedCreateMongoClient.mockResolvedValue(
      createExportClientMock({
        users: [{ _id: "1", name: "Ada" }],
        logs: [{ _id: "2", message: "hi" }],
      }),
    );

    const job = await startExportJob({
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      sourceDatabase: "source-db",
      password: "master-password",
    });

    const completedJob = await waitForJob(job?.id ?? "");
    expect(completedJob.status, completedJob.error ?? "no error").toBe("completed");
    const artifact = await loadExportArtifact(completedJob.id);
    const zip = await JSZip.loadAsync(artifact.content);
    expect(zip.file("users/data.ndjson")).toBeTruthy();
    expect(zip.file("logs/data.ndjson")).toBeTruthy();
  });

  it("rejects export when the connection belongs to a different organization", async () => {
    await expect(
      startExportJob({
        organizationId: "org-2",
        sourceConnectionId: "conn-1",
        sourceDatabase: "source-db",
        password: "master-password",
      }),
    ).rejects.toThrow("Connection must belong to the selected organization.");
  });

  it("cancels an export job safely after cancellation is requested", async () => {
    let releaseFind: (() => void) | undefined;

    mockedCreateMongoClient.mockResolvedValue({
      db: () => ({
        listCollections: () => ({
          toArray: async () => [{ name: "users" }],
        }),
        collection: () => ({
          estimatedDocumentCount: async () => 1,
          listIndexes: () => ({
            toArray: async () => [{ name: "_id_", key: { _id: 1 } }],
          }),
          find: () => ({
            sort() {
              return this;
            },
            batchSize() {
              return this;
            },
            async *[Symbol.asyncIterator]() {
              await new Promise<void>((resolve) => {
                releaseFind = () => resolve();
              });
              yield { _id: "1", name: "Ada" };
            },
            close: async () => undefined,
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
    releaseFind?.();

    const cancelledJob = await waitForJob(job?.id ?? "");

    expect(cancelledJob.status).toBe("cancelled");
    expect(cancelledJob.interruptedReason).toBe("user_cancelled");
    expect(cancelledJob.resultAvailable).toBe(false);
  });
});

async function waitForJob(jobId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
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

  while (Date.now() - startedAt < 10_000) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("Timed out waiting for condition.");
}
