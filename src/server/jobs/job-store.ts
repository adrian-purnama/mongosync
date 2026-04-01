import {
  JOB_RETENTION_MS,
} from "@/src/server/config/constants";
import { decryptText, encryptText } from "@/src/server/security/encryption-service";
import type {
  CopyJob,
  CopyJobLog,
  CopyJobLogLevel,
  CopyJobPersistenceSource,
} from "@/src/types/models";
import {
  appendJobLogLine,
  getOrCreateJobsSecretKey,
  readJobArtifact,
  listPersistedJobIds,
  readJobLogLines,
  readJobSnapshot,
  writeJobArtifact,
  writeJobSnapshot,
} from "./job-files";

async function getJobsEncryptionKey() {
  return getOrCreateJobsSecretKey();
}

function withDiskSource(job: CopyJob, persistenceSource: CopyJobPersistenceSource = "disk") {
  return {
    ...normalizeLegacyJob(job),
    persistenceSource,
  } satisfies CopyJob;
}

export async function persistJobSnapshot(job: CopyJob) {
  const encryptionKey = await getJobsEncryptionKey();
  const snapshot = withDiskSource(
    {
      ...job,
      lastPersistedAt: new Date().toISOString(),
      retentionExpiresAt:
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "interrupted" ||
        job.status === "cancelled"
          ? job.retentionExpiresAt ?? new Date(Date.now() + JOB_RETENTION_MS).toISOString()
          : null,
    },
    "disk",
  );

  await writeJobSnapshot(job.id, encryptText(JSON.stringify(snapshot), encryptionKey));
  return snapshot;
}

export async function appendPersistedJobLog(
  jobId: string,
  log: CopyJobLog,
) {
  const encryptionKey = await getJobsEncryptionKey();
  await appendJobLogLine(jobId, encryptText(JSON.stringify(log), encryptionKey));
}

export async function loadPersistedJob(jobId: string) {
  const encryptionKey = await getJobsEncryptionKey();
  const encryptedSnapshot = await readJobSnapshot(jobId);
  const snapshot = JSON.parse(
    decryptText(encryptedSnapshot, encryptionKey),
  ) as CopyJob;
  const logs = await loadPersistedJobLogs(jobId);

  return withDiskSource({
    ...normalizeLegacyJob(snapshot),
    logs,
  });
}

export async function loadPersistedJobLogs(jobId: string) {
  const encryptionKey = await getJobsEncryptionKey();
  const encryptedLines = await readJobLogLines(jobId);

  return encryptedLines.map(
    (line) => JSON.parse(decryptText(line, encryptionKey)) as CopyJobLog,
  );
}

export async function persistJobArtifact(jobId: string, content: Uint8Array) {
  await writeJobArtifact(jobId, content);
}

export async function loadPersistedJobArtifact(jobId: string) {
  return readJobArtifact(jobId);
}

export async function listPersistedJobs() {
  const jobIds = await listPersistedJobIds();
  const jobs = await Promise.all(
    jobIds.map(async (jobId) => {
      try {
        return await loadPersistedJob(jobId);
      } catch {
        return null;
      }
    }),
  );
  const validJobs: CopyJob[] = [];

  for (const job of jobs) {
    if (job) {
      validJobs.push(job);
    }
  }

  return validJobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function createJobLog(
  sequence: number,
  level: CopyJobLogLevel,
  message: string,
) {
  return {
    sequence,
    timestamp: new Date().toISOString(),
    level,
    message,
  } satisfies CopyJobLog;
}

function normalizeLegacyJob(job: CopyJob) {
  return {
    ...job,
    kind: job.kind ?? "copy",
    targetConnectionId: job.targetConnectionId ?? null,
    targetDatabase: job.targetDatabase ?? null,
    targetCollection: job.targetCollection ?? null,
    targetCollections: job.targetCollections ?? null,
    artifactFileName: job.artifactFileName ?? null,
    artifactStoredAt: job.artifactStoredAt ?? null,
    artifactContentType: job.artifactContentType ?? null,
    resultAvailable: job.resultAvailable ?? false,
    cancelRequestedAt: job.cancelRequestedAt ?? null,
  } satisfies CopyJob;
}
