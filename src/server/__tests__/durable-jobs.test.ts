import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { JOB_RETENTION_MS } from "@/src/server/config/constants";
import { getJobArtifactPath, getJobSnapshotPath } from "@/src/server/jobs/job-files";
import { listPersistedJobs, loadPersistedJob, persistJobArtifact } from "@/src/server/jobs/job-store";
import {
  forceRunJobRetentionCleanupForTests,
  resetJobRetentionCleanupForTests,
} from "@/src/server/jobs/retention-service";
import {
  addCopyJobLog,
  createCopyJob,
  createExportJob,
  initializeCopyJobRuntime,
  listActiveCopyJobs,
  requestCopyJobCancellation,
  resetCopyJobRuntimeForTests,
  updateCopyJob,
} from "@/src/server/mongo/copy-job-store";
import { readTextFile } from "@/src/server/storage/file-system";

describe("durable copy jobs", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-jobs-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;
    resetCopyJobRuntimeForTests();
    resetJobRetentionCleanupForTests();
  });

  afterEach(async () => {
    resetCopyJobRuntimeForTests();
    resetJobRetentionCleanupForTests();
    delete process.env.MONGOSYNC_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists encrypted job snapshots and logs to disk", async () => {
    const job = await createCopyJob({
      id: "job-1",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    await addCopyJobLog(job.id, "info", "Started.");
    const loaded = await loadPersistedJob(job.id);
    const rawSnapshot = await readTextFile(getJobSnapshotPath(job.id));

    expect(loaded.id).toBe(job.id);
    expect(loaded.logs).toHaveLength(1);
    expect(loaded.logs[0]?.message).toBe("Started.");
    expect(loaded.lastPersistedAt).toBeTruthy();
    expect(rawSnapshot).not.toContain('"id":"job-1"');
  });

  it("marks running jobs as interrupted on runtime initialization", async () => {
    const job = await createCopyJob({
      id: "job-2",
      mode: "override",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    await updateCopyJob(job.id, (current) => ({
      ...current,
      status: "running",
    }));

    resetCopyJobRuntimeForTests();
    await initializeCopyJobRuntime();

    const [reloadedJob] = await listPersistedJobs();
    expect(reloadedJob?.status).toBe("interrupted");
    expect(reloadedJob?.interruptedReason).toBe("process_restart");
  });

  it("deletes expired persisted jobs during retention cleanup", async () => {
    const job = await createCopyJob({
      id: "job-3",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    await updateCopyJob(job.id, (current) => ({
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      retentionExpiresAt: new Date(Date.now() - JOB_RETENTION_MS - 1000).toISOString(),
    }));

    resetCopyJobRuntimeForTests();
    await forceRunJobRetentionCleanupForTests();

    const jobs = await listPersistedJobs();
    expect(jobs.find((entry) => entry?.id === job.id)).toBeUndefined();
  });

  it("lists only queued and running jobs as active", async () => {
    const queuedJob = await createCopyJob({
      id: "job-4",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    const completedJob = await createCopyJob({
      id: "job-5",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "accounts",
      targetCollection: "accounts",
      sourceCollections: ["accounts"],
      targetCollections: ["accounts"],
    });

    await updateCopyJob(completedJob.id, (current) => ({
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
    }));

    const activeJobs = await listActiveCopyJobs();
    expect(activeJobs.map((job) => job.id)).toContain(queuedJob.id);
    expect(activeJobs.map((job) => job.id)).not.toContain(completedJob.id);
  });

  it("cancels queued jobs immediately", async () => {
    const job = await createCopyJob({
      id: "job-cancel-1",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      targetConnectionId: "target-1",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    const cancelledJob = await requestCopyJobCancellation(job.id);

    expect(cancelledJob?.status).toBe("cancelled");
    expect(cancelledJob?.interruptedReason).toBe("user_cancelled");
    expect(cancelledJob?.cancelRequestedAt).toBeTruthy();
  });

  it("marks queued export jobs as interrupted on runtime initialization", async () => {
    await createExportJob({
      id: "job-export-1",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      sourceDatabase: "db-a",
      sourceCollection: "entire database",
      sourceCollections: [],
      artifactFileName: "db-a.zip",
    });

    resetCopyJobRuntimeForTests();
    await initializeCopyJobRuntime();

    const [reloadedJob] = await listPersistedJobs();
    expect(reloadedJob?.kind).toBe("export");
    expect(reloadedJob?.status).toBe("interrupted");
    expect(reloadedJob?.interruptedReason).toBe("process_restart");
  });

  it("deletes expired export artifacts during retention cleanup", async () => {
    const job = await createExportJob({
      id: "job-export-2",
      organizationId: "org-1",
      sourceConnectionId: "source-1",
      sourceDatabase: "db-a",
      sourceCollection: "users",
      sourceCollections: ["users"],
      artifactFileName: "db-a.zip",
    });

    await updateCopyJob(job.id, (current) => ({
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      resultAvailable: true,
      artifactStoredAt: new Date().toISOString(),
      retentionExpiresAt: new Date(Date.now() - JOB_RETENTION_MS - 1000).toISOString(),
    }));

    await persistJobArtifact(job.id, Buffer.from("artifact"));

    resetCopyJobRuntimeForTests();
    await forceRunJobRetentionCleanupForTests();

    const jobs = await listPersistedJobs();
    expect(jobs.find((entry) => entry?.id === job.id)).toBeUndefined();
    await expect(readTextFile(getJobArtifactPath(job.id))).rejects.toThrow();
  });
});
