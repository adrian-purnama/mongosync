import {
  COPY_LOG_LIMIT,
  JOB_RUNTIME_CACHE_LIMIT,
} from "@/src/server/config/constants";
import { createJobLog, listPersistedJobs, persistJobSnapshot, appendPersistedJobLog, loadPersistedJob } from "@/src/server/jobs/job-store";
import { runJobRetentionCleanup } from "@/src/server/jobs/retention-service";
import type {
  CopyJob,
  CopyJobInterruptionReason,
  JobKind,
  CopyJobLogLevel,
  CopyMode,
} from "@/src/types/models";

const jobs = new Map<string, CopyJob>();
let initializationPromise: Promise<void> | null = null;

type CreateJobInput = {
  id: string;
  kind: JobKind;
  mode?: CopyMode;
  organizationId: string;
  sourceConnectionId: string;
  targetConnectionId?: string | null;
  sourceDatabase: string;
  targetDatabase?: string | null;
  sourceCollection: string;
  targetCollection?: string | null;
  sourceCollections: string[];
  targetCollections?: string[] | null;
  artifactFileName?: string | null;
  artifactStoredAt?: string | null;
  artifactContentType?: string | null;
  resultAvailable?: boolean;
};

type CreateCopyJobInput = Omit<CreateJobInput, "kind">;

function setCachedJob(job: CopyJob) {
  jobs.set(job.id, {
    ...job,
    persistenceSource: "memory",
  });

  if (jobs.size > JOB_RUNTIME_CACHE_LIMIT) {
    const sortedEntries = [...jobs.entries()].sort((a, b) =>
      b[1].startedAt.localeCompare(a[1].startedAt),
    );
    const retainedEntries = sortedEntries.slice(0, JOB_RUNTIME_CACHE_LIMIT);
    jobs.clear();
    retainedEntries.forEach(([id, entry]) => jobs.set(id, entry));
  }
}

async function initializeRuntimeInternal() {
  await runJobRetentionCleanup();
  const persistedJobs = await listPersistedJobs();

  for (const persistedJob of persistedJobs) {
    if (!persistedJob) {
      continue;
    }

    if (persistedJob.status === "running" || persistedJob.status === "queued") {
      const interruptedJob = {
        ...persistedJob,
        status: "interrupted" as const,
        interruptedReason: "process_restart" as CopyJobInterruptionReason,
        error: persistedJob.error ?? "Job interrupted because the server process restarted.",
        completedAt: persistedJob.completedAt ?? new Date().toISOString(),
      };

      const persistedInterruptedJob = await persistJobSnapshot(interruptedJob);
      setCachedJob(persistedInterruptedJob);
      continue;
    }

    setCachedJob(persistedJob);
  }
}

export async function initializeCopyJobRuntime() {
  if (!initializationPromise) {
    initializationPromise = initializeRuntimeInternal();
  }

  await initializationPromise;
}

async function createJob(input: CreateJobInput) {
  await initializeCopyJobRuntime();

  const job: CopyJob = {
    id: input.id,
    kind: input.kind,
    status: "queued",
    mode: input.mode,
    organizationId: input.organizationId,
    sourceConnectionId: input.sourceConnectionId,
    targetConnectionId: input.targetConnectionId ?? null,
    sourceDatabase: input.sourceDatabase,
    targetDatabase: input.targetDatabase ?? null,
    sourceCollection: input.sourceCollection,
    targetCollection: input.targetCollection ?? null,
    sourceCollections: input.sourceCollections,
    targetCollections: input.targetCollections ?? null,
    processedDocuments: 0,
    totalDocuments: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    cancelRequestedAt: null,
    lastPersistedAt: null,
    retentionExpiresAt: null,
    interruptedReason: null,
    artifactFileName: input.artifactFileName ?? null,
    artifactStoredAt: input.artifactStoredAt ?? null,
    artifactContentType: input.artifactContentType ?? null,
    resultAvailable: input.resultAvailable ?? false,
    logs: [],
    persistenceSource: "memory",
  };

  const persistedJob = await persistJobSnapshot(job);
  setCachedJob(persistedJob);
  return persistedJob;
}

export async function createCopyJob(input: CreateCopyJobInput) {
  return createJob({
    ...input,
    kind: "copy",
  });
}

export async function getCopyJob(jobId: string) {
  await initializeCopyJobRuntime();

  const cached = jobs.get(jobId);

  if (cached) {
    return cached;
  }

  try {
    const persisted = await loadPersistedJob(jobId);
    setCachedJob(persisted);
    return persisted;
  } catch {
    return null;
  }
}

export async function listCopyJobs() {
  await initializeCopyJobRuntime();
  const persistedJobs = await listPersistedJobs();

  for (const job of persistedJobs) {
    if (!job) {
      continue;
    }

    setCachedJob(job);
  }

  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function listActiveCopyJobs() {
  const allJobs = await listCopyJobs();
  return allJobs.filter((job) => job.status === "queued" || job.status === "running");
}

export async function createExportJob(
  input: Omit<
    CreateJobInput,
    "kind" | "mode" | "targetConnectionId" | "targetDatabase" | "targetCollection" | "targetCollections"
  >,
) {
  return createJob({
    ...input,
    kind: "export",
    mode: undefined,
    targetConnectionId: null,
    targetDatabase: null,
    targetCollection: null,
    targetCollections: null,
    artifactContentType: "application/zip",
    resultAvailable: false,
  });
}

export async function updateCopyJob(
  jobId: string,
  updater: (job: CopyJob) => CopyJob,
) {
  await initializeCopyJobRuntime();
  const current = await getCopyJob(jobId);

  if (!current) {
    return null;
  }

  const next = updater(current);
  const persistedJob = await persistJobSnapshot(next);
  setCachedJob({
    ...persistedJob,
    logs: next.logs,
  });
  return persistedJob;
}

export async function requestCopyJobCancellation(jobId: string) {
  await initializeCopyJobRuntime();
  const current = await getCopyJob(jobId);

  if (!current) {
    return null;
  }

  if (
    current.status === "completed" ||
    current.status === "failed" ||
    current.status === "interrupted" ||
    current.status === "cancelled"
  ) {
    return current;
  }

  const cancellationRequestedAt = current.cancelRequestedAt ?? new Date().toISOString();
  const next =
    current.status === "queued"
      ? {
          ...current,
          status: "cancelled" as const,
          cancelRequestedAt: cancellationRequestedAt,
          interruptedReason: "user_cancelled" as const,
          completedAt: new Date().toISOString(),
          error: null,
        }
      : {
          ...current,
          cancelRequestedAt: cancellationRequestedAt,
        };

  const persistedJob = await persistJobSnapshot(next);
  setCachedJob({
    ...persistedJob,
    logs: current.logs,
  });

  if (current.status === "queued") {
    await addCopyJobLog(jobId, "warning", "Job cancelled before execution started.");
  } else if (!current.cancelRequestedAt) {
    await addCopyJobLog(jobId, "warning", "Cancellation requested. Finishing the current safe step.");
  }

  return getCopyJob(jobId);
}

export async function addCopyJobLog(
  jobId: string,
  level: CopyJobLogLevel,
  message: string,
) {
  await initializeCopyJobRuntime();
  const current = await getCopyJob(jobId);

  if (!current) {
    return null;
  }

  const nextSequence = (current.logs.at(-1)?.sequence ?? 0) + 1;
  const nextLog = createJobLog(nextSequence, level, message);
  await appendPersistedJobLog(jobId, nextLog);

  const next = {
    ...current,
    logs: [...current.logs, nextLog].slice(-COPY_LOG_LIMIT),
  };

  const persistedJob = await persistJobSnapshot(next);
  setCachedJob({
    ...persistedJob,
    logs: next.logs,
  });
  return nextLog;
}

export function resetCopyJobRuntimeForTests() {
  jobs.clear();
  initializationPromise = null;
}
