import { JOB_RUNTIME_CACHE_LIMIT } from "@/src/server/config/constants";
import { deletePath } from "@/src/server/storage/file-system";
import { getJobArtifactPath, getJobLogsPath, getJobSnapshotPath } from "./job-files";
import { listPersistedJobs } from "./job-store";

let lastCleanupAt = 0;

export async function runJobRetentionCleanup() {
  return runJobRetentionCleanupInternal(false);
}

async function runJobRetentionCleanupInternal(force: boolean) {
  const now = Date.now();

  if (!force && now - lastCleanupAt < 60_000) {
    return;
  }

  lastCleanupAt = now;

  const jobs = await listPersistedJobs();

  const expiredJobs = jobs.filter((job) => {
    if (!job.retentionExpiresAt) {
      return false;
    }

    if (job.status === "running" || job.status === "queued") {
      return false;
    }

    return new Date(job.retentionExpiresAt).getTime() <= now;
  });

  await Promise.all(
    expiredJobs.flatMap((job) => [
      deletePath(getJobSnapshotPath(job.id)),
      deletePath(getJobLogsPath(job.id)),
      deletePath(getJobArtifactPath(job.id)),
    ]),
  );

  return jobs.slice(0, JOB_RUNTIME_CACHE_LIMIT);
}

export async function forceRunJobRetentionCleanupForTests() {
  return runJobRetentionCleanupInternal(true);
}

export function resetJobRetentionCleanupForTests() {
  lastCleanupAt = 0;
}
