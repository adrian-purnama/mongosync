import {
  COPY_LOG_LIMIT,
  JOB_RUNTIME_CACHE_LIMIT,
} from "@/src/server/config/constants";
import { JOB_PERSIST_INTERVAL_MS } from "@/src/server/mongo/copy-config";
import {
  abortJob,
  clearJobAbortController,
  resetJobAbortControllersForTests,
} from "@/src/server/mongo/job-runtime";
import {
  createJobLog,
  listPersistedJobs,
  persistJobSnapshot,
  appendPersistedJobLog,
  loadPersistedJob,
} from "@/src/server/jobs/job-store";
import { runJobRetentionCleanup } from "@/src/server/jobs/retention-service";
import type {
  CopyJob,
  CopyJobInterruptionReason,
  JobKind,
  CopyJobLogLevel,
  CopyMode,
  CollectionCheckpoint,
  SwapStep,
  JobLockInfo,
} from "@/src/types/models";

const jobs = new Map<string, CopyJob>();
const dirtyJobIds = new Set<string>();
const lastDiskPersistAt = new Map<string, number>();
let persistTimer: ReturnType<typeof setInterval> | null = null;
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
  filter?: Record<string, unknown> | null;
  limit?: number | null;
  checkpoints?: CollectionCheckpoint[];
  swapSteps?: SwapStep[];
  journalCollection?: string | null;
};

type CreateCopyJobInput = Omit<CreateJobInput, "kind">;

const TERMINAL_STATUSES = new Set<CopyJob["status"]>([
  "completed",
  "failed",
  "cancelled",
  "reverted",
  "interrupted",
]);

const STATUS_CHANGE_FORCE_PERSIST = new Set<CopyJob["status"]>([
  "queued",
  "running",
  "paused",
  "verifying",
  "swapping",
  "completed",
  "failed",
  "cancelled",
  "reverted",
  "interrupted",
]);

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

function ensurePersistTimer() {
  if (persistTimer) {
    return;
  }

  persistTimer = setInterval(() => {
    void flushDirtyJobs();
  }, JOB_PERSIST_INTERVAL_MS);
  persistTimer.unref?.();
}

async function flushDirtyJobs() {
  const ids = [...dirtyJobIds];
  dirtyJobIds.clear();

  for (const jobId of ids) {
    const job = jobs.get(jobId);
    if (!job) {
      continue;
    }

    try {
      const persisted = await persistJobSnapshot(job);
      lastDiskPersistAt.set(jobId, Date.now());
      setCachedJob({
        ...persisted,
        logs: job.logs,
      });
    } catch {
      dirtyJobIds.add(jobId);
    }
  }
}

const persistChains = new Map<string, Promise<unknown>>();

async function persistNow(job: CopyJob) {
  const previous = persistChains.get(job.id) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const persisted = await persistJobSnapshot(job);
      lastDiskPersistAt.set(job.id, Date.now());
      dirtyJobIds.delete(job.id);
      setCachedJob({
        ...persisted,
        logs: job.logs,
      });
      return persisted;
    });

  persistChains.set(
    job.id,
    next.finally(() => {
      if (persistChains.get(job.id) === next) {
        persistChains.delete(job.id);
      }
    }),
  );

  return next;
}

async function initializeRuntimeInternal() {
  await runJobRetentionCleanup();
  const persistedJobs = await listPersistedJobs();

  for (const persistedJob of persistedJobs) {
    if (!persistedJob) {
      continue;
    }

    if (persistedJob.status === "running" || persistedJob.status === "queued") {
      const pausedJob: CopyJob = {
        ...persistedJob,
        status: "paused",
        resumable: true,
        interruptedReason: "process_restart" as CopyJobInterruptionReason,
        error:
          persistedJob.error ??
          "Job paused because the server process restarted. You can resume.",
        completedAt: null,
      };

      const persistedPausedJob = await persistJobSnapshot(pausedJob);
      setCachedJob(persistedPausedJob);
      continue;
    }

    if (persistedJob.status === "interrupted") {
      const migrated: CopyJob = {
        ...persistedJob,
        status: "paused",
        resumable: Boolean(persistedJob.checkpoints?.length),
      };
      setCachedJob(migrated);
      continue;
    }

    if (persistedJob.status === "verifying" || persistedJob.status === "swapping") {
      const pausedJob: CopyJob = {
        ...persistedJob,
        status: "paused",
        resumable: true,
        interruptedReason: "process_restart",
        error:
          persistedJob.error ??
          "Job paused mid-finalize because the server process restarted. Resume to finish or revert.",
        completedAt: null,
      };
      const persistedPausedJob = await persistJobSnapshot(pausedJob);
      setCachedJob(persistedPausedJob);
      continue;
    }

    setCachedJob(persistedJob);
  }

  ensurePersistTimer();
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
    processedBytes: 0,
    totalDocuments: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    cancelRequestedAt: null,
    lastPersistedAt: null,
    retentionExpiresAt: null,
    interruptedReason: null,
    resumable: input.kind === "copy" || input.kind === "import",
    checkpoints: input.checkpoints ?? [],
    swapSteps: input.swapSteps ?? [],
    journalCollection: input.journalCollection ?? null,
    lock: null,
    backupBytesEstimate: null,
    filter: input.filter ?? null,
    limit: input.limit ?? null,
    artifactFileName: input.artifactFileName ?? null,
    artifactStoredAt: input.artifactStoredAt ?? null,
    artifactContentType: input.artifactContentType ?? null,
    resultAvailable: input.resultAvailable ?? false,
    logs: [],
    persistenceSource: "memory",
  };

  const persistedJob = await persistNow(job);
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
  return allJobs.filter(
    (job) =>
      job.status === "queued" ||
      job.status === "running" ||
      job.status === "verifying" ||
      job.status === "swapping",
  );
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

export async function createImportJob(
  input: Omit<CreateJobInput, "kind"> & { mode?: CopyMode },
) {
  return createJob({
    ...input,
    kind: "import",
    mode: input.mode ?? "override",
  });
}

export async function updateCopyJob(
  jobId: string,
  updater: (job: CopyJob) => CopyJob,
  options?: { forcePersist?: boolean },
) {
  await initializeCopyJobRuntime();
  const current = await getCopyJob(jobId);

  if (!current) {
    return null;
  }

  const next = updater(current);
  const statusChanged = next.status !== current.status;
  const force =
    options?.forcePersist ||
    statusChanged ||
    STATUS_CHANGE_FORCE_PERSIST.has(next.status);

  setCachedJob(next);

  if (force) {
    return persistNow(next);
  }

  dirtyJobIds.add(jobId);
  ensurePersistTimer();

  const last = lastDiskPersistAt.get(jobId) ?? 0;
  if (Date.now() - last >= JOB_PERSIST_INTERVAL_MS) {
    return persistNow(next);
  }

  return next;
}

export async function setJobLockInfo(jobId: string, lock: JobLockInfo | null) {
  return updateCopyJob(jobId, (job) => ({ ...job, lock }), { forcePersist: true });
}

export async function requestCopyJobCancellation(jobId: string) {
  await initializeCopyJobRuntime();
  const current = await getCopyJob(jobId);

  if (!current) {
    return null;
  }

  if (TERMINAL_STATUSES.has(current.status) && current.status !== "paused") {
    if (
      current.status === "completed" ||
      current.status === "failed" ||
      current.status === "interrupted" ||
      current.status === "cancelled" ||
      current.status === "reverted"
    ) {
      return current;
    }
  }

  abortJob(jobId);

  const cancellationRequestedAt = current.cancelRequestedAt ?? new Date().toISOString();
  const next =
    current.status === "queued" || current.status === "paused"
      ? {
          ...current,
          status: "cancelled" as const,
          cancelRequestedAt: cancellationRequestedAt,
          interruptedReason: "user_cancelled" as const,
          completedAt: new Date().toISOString(),
          error: null,
          resumable: false,
        }
      : {
          ...current,
          cancelRequestedAt: cancellationRequestedAt,
        };

  await persistNow(next);

  if (current.status === "queued" || current.status === "paused") {
    await addCopyJobLog(jobId, "warning", "Job cancelled.");
    clearJobAbortController(jobId);
  } else if (!current.cancelRequestedAt) {
    await addCopyJobLog(
      jobId,
      "warning",
      "Cancellation requested. Finishing the current safe step.",
    );
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

  setCachedJob(next);
  dirtyJobIds.add(jobId);
  ensurePersistTimer();
  return nextLog;
}

export function resetCopyJobRuntimeForTests() {
  jobs.clear();
  dirtyJobIds.clear();
  lastDiskPersistAt.clear();
  initializationPromise = null;
  if (persistTimer) {
    clearInterval(persistTimer);
    persistTimer = null;
  }
  resetJobAbortControllersForTests();
}

export async function flushJobPersistenceForTests() {
  await flushDirtyJobs();
}
