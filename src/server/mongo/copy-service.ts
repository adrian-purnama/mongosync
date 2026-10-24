import { randomUUID } from "node:crypto";

import { BACKUP_KEEP_JOBS } from "@/src/server/mongo/copy-config";
import {
  CancellationRequestedError,
  cleanupStagingOnCancel,
  runCopyEngine,
} from "@/src/server/mongo/copy/engine";
import {
  buildRevertSwapSteps,
  dropCollectionIfExists,
  dropStagingCollections,
  estimateBackupBytes,
  executeSwapSteps,
  journalCollectionName,
} from "@/src/server/mongo/copy/staging";
import {
  acquireJobLock,
  forceUnlockTarget,
  getTargetLock,
  type AcquiredLock,
} from "@/src/server/mongo/lock/job-lock";
import {
  clearJobAbortController,
  getOrCreateJobAbortController,
} from "@/src/server/mongo/job-runtime";
import {
  getConnectionById,
  decryptConnectionUrl,
} from "@/src/server/connections/connection-service";
import { AppError } from "@/src/server/utils/errors";
import { createMongoClient } from "./mongo-client-factory";
import {
  addCopyJobLog,
  createCopyJob,
  getCopyJob,
  listCopyJobs,
  setJobLockInfo,
  updateCopyJob,
} from "./copy-job-store";

type StartCopyJobInput = {
  organizationId: string;
  sourceConnectionId: string;
  targetConnectionId: string;
  sourceDatabase: string;
  targetDatabase: string;
  sourceCollections: string[];
  mode: "override" | "append" | "new";
  newCollectionName?: string;
  filter?: Record<string, unknown>;
  limit?: number;
  password: string;
};

async function assertConnections(input: StartCopyJobInput) {
  if (input.sourceConnectionId === input.targetConnectionId) {
    throw new AppError("Source and target connections must be different.");
  }

  const sourceConnection = await getConnectionById(input.sourceConnectionId);
  const targetConnection = await getConnectionById(input.targetConnectionId);

  if (!sourceConnection || !targetConnection) {
    throw new AppError("Source or target connection was not found.", 404);
  }

  if (
    sourceConnection.organizationId !== input.organizationId ||
    targetConnection.organizationId !== input.organizationId
  ) {
    throw new AppError("Connections must belong to the selected organization.");
  }

  if (input.mode === "override" && targetConnection.locked) {
    throw new AppError(
      "Locked target connections cannot be overwritten in override mode.",
      409,
    );
  }

  if (input.mode === "new" && input.sourceCollections.length !== 1) {
    throw new AppError(
      "Copy to new collection supports exactly one source collection at a time.",
      400,
    );
  }

  return { sourceConnection, targetConnection };
}

export async function startCopyJob(input: StartCopyJobInput) {
  const { sourceConnection, targetConnection } = await assertConnections(input);

  const jobId = randomUUID();
  const sourceCollections = [...input.sourceCollections];
  const targetCollections =
    input.mode === "new"
      ? [input.newCollectionName!.trim()]
      : sourceCollections;
  const summarySourceCollection =
    sourceCollections.length === 1
      ? sourceCollections[0]
      : `${sourceCollections.length} collections`;
  const summaryTargetCollection =
    targetCollections.length === 1
      ? targetCollections[0]
      : `${targetCollections.length} collections`;

  await createCopyJob({
    id: jobId,
    mode: input.mode,
    organizationId: input.organizationId,
    sourceConnectionId: input.sourceConnectionId,
    targetConnectionId: input.targetConnectionId,
    sourceDatabase: input.sourceDatabase,
    targetDatabase: input.targetDatabase,
    sourceCollection: summarySourceCollection,
    targetCollection: summaryTargetCollection,
    sourceCollections,
    targetCollections,
    filter: input.filter ?? null,
    limit: input.limit ?? null,
  });

  void executeCopyJob({
    ...input,
    sourceCollections,
    targetCollections,
    sourceConnection,
    targetConnection,
    jobId,
  });

  return getCopyJob(jobId);
}

export async function resumeCopyJob(input: {
  jobId: string;
  password: string;
}) {
  const job = await getCopyJob(input.jobId);
  if (!job) {
    throw new AppError("Copy job not found.", 404);
  }

  if (job.kind !== "copy" && job.kind !== "import") {
    throw new AppError("Only copy/import jobs can be resumed.", 400);
  }

  if (job.status !== "paused") {
    throw new AppError("Only paused jobs can be resumed.", 409);
  }

  if (!job.targetConnectionId || !job.targetDatabase || !job.mode) {
    throw new AppError("Job is missing target details required to resume.", 400);
  }

  const sourceConnection = await getConnectionById(job.sourceConnectionId);
  const targetConnection = await getConnectionById(job.targetConnectionId);
  if (!sourceConnection || !targetConnection) {
    throw new AppError("Source or target connection was not found.", 404);
  }

  await updateCopyJob(
    job.id,
    (current) => ({
      ...current,
      status: "queued",
      error: null,
      interruptedReason: null,
      cancelRequestedAt: null,
      completedAt: null,
    }),
    { forcePersist: true },
  );

  void executeCopyJob({
    organizationId: job.organizationId,
    sourceConnectionId: job.sourceConnectionId,
    targetConnectionId: job.targetConnectionId,
    sourceDatabase: job.sourceDatabase,
    targetDatabase: job.targetDatabase,
    sourceCollections: job.sourceCollections,
    targetCollections: job.targetCollections ?? job.sourceCollections,
    mode: job.mode,
    filter: job.filter ?? undefined,
    limit: job.limit ?? undefined,
    password: input.password,
    sourceConnection,
    targetConnection,
    jobId: job.id,
  });

  return getCopyJob(job.id);
}

async function executeCopyJob(
  input: StartCopyJobInput & {
    jobId: string;
    targetCollections: string[];
    sourceCollections: string[];
    sourceConnection: NonNullable<Awaited<ReturnType<typeof getConnectionById>>>;
    targetConnection: NonNullable<Awaited<ReturnType<typeof getConnectionById>>>;
  },
) {
  const sourceUri = decryptConnectionUrl(input.sourceConnection, input.password);
  const targetUri = decryptConnectionUrl(input.targetConnection, input.password);

  const sourceClient = await createMongoClient(sourceUri, {
    readPreference: "secondaryPreferred",
  });
  const targetClient = await createMongoClient(targetUri);

  const controller = getOrCreateJobAbortController(input.jobId);
  let acquiredLock: AcquiredLock | null = null;

  try {
    const startingJob = await getCopyJob(input.jobId);
    if (!startingJob || startingJob.status === "cancelled") {
      return;
    }

    acquiredLock = await acquireJobLock({
      client: targetClient,
      connectionId: input.targetConnectionId,
      database: input.targetDatabase,
      jobId: input.jobId,
    });
    await setJobLockInfo(input.jobId, acquiredLock.info);

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "running",
        interruptedReason: null,
        error: null,
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(input.jobId, "info", "Connections established. Target locked.");

    const result = await runCopyEngine({
      sourceClient,
      targetClient,
      sourceDatabase: input.sourceDatabase,
      targetDatabase: input.targetDatabase,
      sourceCollections: input.sourceCollections,
      targetCollections: input.targetCollections,
      mode: input.mode,
      filter: input.filter,
      limit: input.limit,
      jobId: input.jobId,
      callbacks: {
        signal: controller.signal,
        getJob: () => getCopyJob(input.jobId),
        updateJob: (updater) => updateCopyJob(input.jobId, updater),
        log: (level, message) => addCopyJobLog(input.jobId, level, message),
      },
    });

    if (result.outcome === "paused") {
      return;
    }
  } catch (error) {
    if (
      error instanceof CancellationRequestedError ||
      controller.signal.aborted
    ) {
      const job = await getCopyJob(input.jobId);
      if (job) {
        await cleanupStagingOnCancel(targetClient, input.targetDatabase, job);
      }

      await updateCopyJob(
        input.jobId,
        (current) => ({
          ...current,
          status: "cancelled",
          interruptedReason: "user_cancelled",
          completedAt: new Date().toISOString(),
          error: null,
          resumable: false,
        }),
        { forcePersist: true },
      );
      await addCopyJobLog(input.jobId, "warning", "Copy job cancelled safely.");
      return;
    }

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date().toISOString(),
        resumable: Boolean(job.checkpoints?.some((checkpoint) => checkpoint.docsCopied > 0)),
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(
      input.jobId,
      "error",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    if (acquiredLock) {
      acquiredLock.stopHeartbeat();
      await acquiredLock.release().catch(() => undefined);
      await setJobLockInfo(input.jobId, null);
    }
    clearJobAbortController(input.jobId);
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
}

export async function revertCopyJob(input: {
  jobId: string;
  password: string;
}) {
  const job = await getCopyJob(input.jobId);
  if (!job) {
    throw new AppError("Copy job not found.", 404);
  }

  if (job.kind !== "copy" && job.kind !== "import") {
    throw new AppError("Only copy/import jobs can be reverted.", 400);
  }

  if (job.status !== "completed") {
    throw new AppError("Only completed jobs can be reverted.", 409);
  }

  if (!job.targetConnectionId || !job.targetDatabase || !job.mode) {
    throw new AppError("Job is missing target details required to revert.", 400);
  }

  const completedJobs = (await listCopyJobs())
    .filter(
      (entry) =>
        (entry.kind === "copy" || entry.kind === "import") &&
        entry.status === "completed" &&
        entry.targetConnectionId === job.targetConnectionId &&
        entry.targetDatabase === job.targetDatabase,
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const revertible = completedJobs.slice(0, BACKUP_KEEP_JOBS);
  if (!revertible.some((entry) => entry.id === job.id)) {
    throw new AppError(
      `Revert is only available for the last ${BACKUP_KEEP_JOBS} completed jobs on this target.`,
      409,
    );
  }

  const targetConnection = await getConnectionById(job.targetConnectionId);
  if (!targetConnection) {
    throw new AppError("Target connection was not found.", 404);
  }

  const targetUri = decryptConnectionUrl(targetConnection, input.password);
  const targetClient = await createMongoClient(targetUri);
  let acquiredLock: AcquiredLock | null = null;

  try {
    acquiredLock = await acquireJobLock({
      client: targetClient,
      connectionId: job.targetConnectionId,
      database: job.targetDatabase,
      jobId: `revert-${job.id}`,
    });

    const db = targetClient.db(job.targetDatabase);

    if (job.mode === "append") {
      const journalName = job.journalCollection ?? journalCollectionName(job.id);
      const journal = db.collection(journalName);
      const ids = await journal.find({}).project({ _id: 1 }).toArray();
      const idList = ids.map((doc) => doc._id);

      for (const collectionName of job.targetCollections ?? job.sourceCollections) {
        if (idList.length === 0) {
          break;
        }
        await db.collection(collectionName).deleteMany({ _id: { $in: idList as never[] } });
      }

      await dropCollectionIfExists(db, journalName);
    } else if (job.mode === "override") {
      const steps = buildRevertSwapSteps(job.checkpoints ?? []);
      await executeSwapSteps(db, steps, async () => undefined);
    } else if (job.mode === "new") {
      for (const checkpoint of job.checkpoints ?? []) {
        await dropCollectionIfExists(db, checkpoint.targetCollection);
      }
    }

    await updateCopyJob(
      job.id,
      (current) => ({
        ...current,
        status: "reverted",
        completedAt: new Date().toISOString(),
        resumable: false,
        backupBytesEstimate: 0,
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(job.id, "info", "Copy job reverted.");
    return getCopyJob(job.id);
  } finally {
    if (acquiredLock) {
      acquiredLock.stopHeartbeat();
      await acquiredLock.release().catch(() => undefined);
    }
    await targetClient.close();
  }
}

export async function cleanupCopyBackups(input: {
  organizationId: string;
  targetConnectionId: string;
  targetDatabase: string;
  password: string;
  keepJobs?: number;
}) {
  const targetConnection = await getConnectionById(input.targetConnectionId);
  if (!targetConnection) {
    throw new AppError("Target connection was not found.", 404);
  }

  if (targetConnection.organizationId !== input.organizationId) {
    throw new AppError("Connection must belong to the selected organization.");
  }

  const keep = input.keepJobs ?? BACKUP_KEEP_JOBS;
  const jobs = (await listCopyJobs())
    .filter(
      (job) =>
        job.targetConnectionId === input.targetConnectionId &&
        job.targetDatabase === input.targetDatabase &&
        (job.status === "completed" || job.status === "reverted"),
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const keepIds = new Set(jobs.slice(0, keep).map((job) => job.id));
  const targetUri = decryptConnectionUrl(targetConnection, input.password);
  const client = await createMongoClient(targetUri);

  try {
    const db = client.db(input.targetDatabase);
    let dropped = 0;

    for (const job of jobs) {
      if (keepIds.has(job.id) && job.status === "completed") {
        continue;
      }

      for (const checkpoint of job.checkpoints ?? []) {
        if (checkpoint.backupCollection) {
          await dropCollectionIfExists(db, checkpoint.backupCollection);
          dropped += 1;
        }
        if (job.journalCollection) {
          await dropCollectionIfExists(db, job.journalCollection);
        }
        if (job.status !== "completed") {
          await dropStagingCollections(db, job.checkpoints ?? []);
        }
      }

      if (job.status === "completed") {
        await updateCopyJob(
          job.id,
          (current) => ({
            ...current,
            backupBytesEstimate: 0,
          }),
          { forcePersist: true },
        );
      }
    }

    const remaining = jobs.filter((job) => keepIds.has(job.id) && job.status === "completed");
    let bytes = 0;
    for (const job of remaining) {
      bytes += await estimateBackupBytes(db, job.checkpoints ?? []);
    }

    return { droppedCollections: dropped, backupBytesEstimate: bytes };
  } finally {
    await client.close();
  }
}

export async function inspectTargetLock(input: {
  connectionId: string;
  database: string;
  password: string;
}) {
  const connection = await getConnectionById(input.connectionId);
  if (!connection) {
    throw new AppError("Connection was not found.", 404);
  }

  const uri = decryptConnectionUrl(connection, input.password);
  const client = await createMongoClient(uri);

  try {
    return await getTargetLock(client, input.database);
  } finally {
    await client.close();
  }
}

export async function forceUnlockTargetDatabase(input: {
  connectionId: string;
  database: string;
  password: string;
  confirmDatabaseName: string;
}) {
  if (input.confirmDatabaseName !== input.database) {
    throw new AppError("Database name confirmation did not match.", 400);
  }

  const connection = await getConnectionById(input.connectionId);
  if (!connection) {
    throw new AppError("Connection was not found.", 404);
  }

  const uri = decryptConnectionUrl(connection, input.password);
  const client = await createMongoClient(uri);

  try {
    await forceUnlockTarget({
      client,
      connectionId: input.connectionId,
      database: input.database,
    });
    return { success: true as const };
  } finally {
    await client.close();
  }
}
