import type {
  Collection,
  Db,
  Document,
  Filter,
  MongoClient,
} from "mongodb";

import { BATCH_DOCS } from "@/src/server/mongo/copy-config";
import {
  createBatchAccumulator,
  InflightWriteGate,
  pushToBatch,
  shouldFlushBatch,
  takeBatch,
} from "@/src/server/mongo/copy/batching";
import {
  buildInitialCheckpoints,
  serializeLastId,
  sumCheckpointBytes,
  sumCheckpointDocs,
  updateCheckpoint,
} from "@/src/server/mongo/copy/checkpoint";
import {
  createIndexesAfterData,
  ensureCollectionWithOptions,
  readSourceCollectionOptions,
  readSourceIndexes,
} from "@/src/server/mongo/copy/indexes";
import {
  buildNewCollectionSwapSteps,
  buildReplaceSwapSteps,
  dropStagingCollections,
  estimateBackupBytes,
  executeSwapSteps,
  journalCollectionName,
} from "@/src/server/mongo/copy/staging";
import { verifyAllCollections } from "@/src/server/mongo/copy/verify";
import { createLimit } from "@/src/server/mongo/util/limit";
import {
  isDuplicateKeyError,
  isRetryableMongoError,
  withRetry,
} from "@/src/server/mongo/util/retry";
import { COLLECTION_CONCURRENCY } from "@/src/server/mongo/copy-config";
import { AppError } from "@/src/server/utils/errors";
import type {
  CollectionCheckpoint,
  CopyJob,
  CopyMode,
  SwapStep,
} from "@/src/types/models";

export class CancellationRequestedError extends Error {
  constructor() {
    super("Job cancellation requested.");
    this.name = "CancellationRequestedError";
  }
}

export class RetriesExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetriesExhaustedError";
  }
}

export type CopyEngineCallbacks = {
  getJob: () => Promise<CopyJob | null>;
  updateJob: (updater: (job: CopyJob) => CopyJob) => Promise<CopyJob | null>;
  log: (
    level: "info" | "warning" | "error",
    message: string,
  ) => Promise<unknown>;
  signal: AbortSignal;
};

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new CancellationRequestedError();
  }
}

async function insertBatchWithRetry(input: {
  collection: Collection<Document>;
  docs: Document[];
  signal: AbortSignal;
  onRetry: (error: unknown, attempt: number, waitMs: number) => Promise<void>;
  journalCollection?: Collection<Document> | null;
}) {
  await withRetry(
    async () => {
      try {
        await input.collection.insertMany(input.docs, {
          ordered: false,
          bypassDocumentValidation: true,
          writeConcern: { w: 1 },
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return;
        }
        throw error;
      }

      if (input.journalCollection) {
        const ids = input.docs
          .map((doc) => doc._id)
          .filter((id) => id !== undefined)
          .map((id) => ({ _id: id }));
        if (ids.length > 0) {
          try {
            await input.journalCollection.insertMany(ids, {
              ordered: false,
              writeConcern: { w: 1 },
            });
          } catch (error) {
            if (!isDuplicateKeyError(error)) {
              throw error;
            }
          }
        }
      }
    },
    {
      signal: input.signal,
      shouldRetry: isRetryableMongoError,
      onRetry: input.onRetry,
    },
  );
}

async function copyOneCollection(input: {
  sourceDb: Db;
  targetDb: Db;
  checkpoint: CollectionCheckpoint;
  mode: CopyMode;
  filter: Filter<Document>;
  limit?: number;
  callbacks: CopyEngineCallbacks;
  journalCollection?: Collection<Document> | null;
}) {
  const { callbacks, checkpoint, mode } = input;
  throwIfAborted(callbacks.signal);

  await callbacks.updateJob((job) => ({
    ...job,
    checkpoints: updateCheckpoint(job, checkpoint.sourceCollection, {
      status: "copying",
    }),
  }));
  await callbacks.log(
    "info",
    `Copying ${checkpoint.sourceCollection} → ${checkpoint.stagingCollection}.`,
  );

  const sourceCollection = input.sourceDb.collection(checkpoint.sourceCollection);
  const sourceOptions = await readSourceCollectionOptions(
    input.sourceDb,
    checkpoint.sourceCollection,
  );
  const sourceIndexes = await readSourceIndexes(sourceCollection);

  if (mode !== "append") {
    await ensureCollectionWithOptions(
      input.targetDb,
      checkpoint.stagingCollection,
      sourceOptions,
    );
  }

  const targetCollection = input.targetDb.collection(checkpoint.stagingCollection);
  const resumeFilter: Filter<Document> =
    checkpoint.lastId != null
      ? ({
          ...input.filter,
          _id: { $gt: checkpoint.lastId as never },
        } as Filter<Document>)
      : input.filter;

  const cursor = sourceCollection.find(resumeFilter, {
    batchSize: BATCH_DOCS,
    sort: { _id: 1 },
  });

  if (input.limit != null) {
    const remaining = Math.max(0, input.limit - checkpoint.docsCopied);
    cursor.limit(remaining);
  }

  const batch = createBatchAccumulator();
  const gate = new InflightWriteGate();
  let localDocs = checkpoint.docsCopied;
  let localBytes = checkpoint.bytesCopied;
  let lastId: unknown = checkpoint.lastId;

  const flush = async () => {
    if (batch.docs.length === 0) {
      return;
    }

    throwIfAborted(callbacks.signal);
    const taken = takeBatch(batch);
    const batchLastId = taken.docs[taken.docs.length - 1]?._id;

    await gate.enqueue(async () => {
      try {
        await insertBatchWithRetry({
          collection: targetCollection,
          docs: taken.docs,
          signal: callbacks.signal,
          journalCollection: input.journalCollection,
          onRetry: async (error, attempt, waitMs) => {
            await callbacks.log(
              "warning",
              `Retry ${attempt} for ${checkpoint.sourceCollection} after ${waitMs}ms: ${
                error instanceof Error ? error.message : "error"
              }`,
            );
          },
        });
      } catch (error) {
        if (isRetryableMongoError(error)) {
          throw new RetriesExhaustedError(
            error instanceof Error ? error.message : "Retries exhausted.",
          );
        }
        throw error;
      }

      localDocs += taken.docs.length;
      localBytes += taken.bytes;
      lastId = batchLastId;

      await callbacks.updateJob((job) => {
        const checkpoints = updateCheckpoint(job, checkpoint.sourceCollection, {
          lastId: serializeLastId(lastId),
          docsCopied: localDocs,
          bytesCopied: localBytes,
          status: "copying",
        });

        return {
          ...job,
          checkpoints,
          processedDocuments: sumCheckpointDocs(checkpoints),
          processedBytes: sumCheckpointBytes(checkpoints),
        };
      });
    });
  };

  try {
    for await (const document of cursor) {
      throwIfAborted(callbacks.signal);
      pushToBatch(batch, document);
      if (shouldFlushBatch(batch)) {
        await flush();
      }
    }

    await flush();
    await gate.drain();
  } finally {
    await cursor.close().catch(() => undefined);
  }

  if (mode !== "append" && !checkpoint.indexesCreated) {
    await createIndexesAfterData(targetCollection, sourceIndexes);
    await callbacks.updateJob((job) => ({
      ...job,
      checkpoints: updateCheckpoint(job, checkpoint.sourceCollection, {
        indexesCreated: true,
        status: "indexed",
        docsCopied: localDocs,
        bytesCopied: localBytes,
        lastId: serializeLastId(lastId),
      }),
    }));
    await callbacks.log(
      "info",
      `Created indexes for ${checkpoint.stagingCollection}.`,
    );
  } else {
    await callbacks.updateJob((job) => ({
      ...job,
      checkpoints: updateCheckpoint(job, checkpoint.sourceCollection, {
        status: "copied",
        docsCopied: localDocs,
        bytesCopied: localBytes,
        lastId: serializeLastId(lastId),
      }),
    }));
  }
}

async function resolveTotalDocuments(input: {
  sourceDb: Db;
  collections: string[];
  filter: Filter<Document>;
  callbacks: CopyEngineCallbacks;
}) {
  try {
    let total = 0;
    const hasFilter = Object.keys(input.filter).length > 0;

    for (const name of input.collections) {
      const collection = input.sourceDb.collection(name);
      total += hasFilter
        ? await collection.countDocuments(input.filter)
        : await collection.estimatedDocumentCount();
    }

    await input.callbacks.updateJob((job) => ({
      ...job,
      totalDocuments: total,
    }));
  } catch (error) {
    await input.callbacks.log(
      "warning",
      `Could not estimate document count: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

export async function runCopyEngine(input: {
  sourceClient: MongoClient;
  targetClient: MongoClient;
  sourceDatabase: string;
  targetDatabase: string;
  sourceCollections: string[];
  targetCollections: string[];
  mode: CopyMode;
  filter?: Record<string, unknown>;
  limit?: number;
  jobId: string;
  callbacks: CopyEngineCallbacks;
}) {
  const sourceDb = input.sourceClient.db(input.sourceDatabase);
  const targetDb = input.targetClient.db(input.targetDatabase);
  const filter = (input.filter ?? {}) as Filter<Document>;
  const callbacks = input.callbacks;

  throwIfAborted(callbacks.signal);

  let job = await callbacks.getJob();
  if (!job) {
    throw new AppError("Copy job not found.", 404);
  }

  if (!job.checkpoints || job.checkpoints.length === 0) {
    const checkpoints = buildInitialCheckpoints(
      input.sourceCollections,
      input.targetCollections,
      input.jobId,
      input.mode,
    );
    job =
      (await callbacks.updateJob((current) => ({
        ...current,
        checkpoints,
        journalCollection:
          input.mode === "append" ? journalCollectionName(input.jobId) : null,
        filter: input.filter ?? null,
        limit: input.limit ?? null,
        resumable: true,
      }))) ?? job;
  }

  void resolveTotalDocuments({
    sourceDb,
    collections: input.sourceCollections,
    filter,
    callbacks,
  });

  const journalCollection =
    input.mode === "append"
      ? targetDb.collection(journalCollectionName(input.jobId))
      : null;

  const limit = createLimit(COLLECTION_CONCURRENCY);
  const checkpoints = (await callbacks.getJob())?.checkpoints ?? [];

  try {
    await Promise.all(
      checkpoints.map((checkpoint) =>
        limit(async () => {
          const latest = await callbacks.getJob();
          const current = latest?.checkpoints?.find(
            (entry) => entry.sourceCollection === checkpoint.sourceCollection,
          );
          if (!current || current.status === "indexed" || current.status === "swapped") {
            return;
          }

          await copyOneCollection({
            sourceDb,
            targetDb,
            checkpoint: current,
            mode: input.mode,
            filter,
            limit: input.limit,
            callbacks,
            journalCollection,
          });
        }),
      ),
    );
  } catch (error) {
    if (error instanceof RetriesExhaustedError) {
      await callbacks.updateJob((current) => ({
        ...current,
        status: "paused",
        resumable: true,
        interruptedReason: "retries_exhausted",
        error: error.message,
      }));
      await callbacks.log("warning", `Job paused: ${error.message}`);
      return { outcome: "paused" as const };
    }
    throw error;
  }

  throwIfAborted(callbacks.signal);

  if (input.mode === "append") {
    await callbacks.updateJob((current) => ({
      ...current,
      status: "completed",
      completedAt: new Date().toISOString(),
      error: null,
      interruptedReason: null,
      resumable: true,
    }));
    await callbacks.log("info", "Append copy completed. Journal retained for revert.");
    return { outcome: "completed" as const };
  }

  await callbacks.updateJob((current) => ({
    ...current,
    status: "verifying",
  }));
  await callbacks.log("info", "Verifying staging collections against source…");

  const latestCheckpoints =
    (await callbacks.getJob())?.checkpoints ?? checkpoints;

  try {
    await verifyAllCollections(sourceDb, targetDb, latestCheckpoints, filter);
  } catch (error) {
    await dropStagingCollections(targetDb, latestCheckpoints);
    throw error;
  }

  throwIfAborted(callbacks.signal);

  const swapSteps: SwapStep[] =
    input.mode === "new"
      ? buildNewCollectionSwapSteps(latestCheckpoints)
      : buildReplaceSwapSteps(latestCheckpoints);

  await callbacks.updateJob((current) => ({
    ...current,
    status: "swapping",
    swapSteps,
  }));
  await callbacks.log("info", "Swapping staging collections into place…");

  await executeSwapSteps(targetDb, swapSteps, async (step, index) => {
    await callbacks.updateJob((current) => {
      const steps = [...(current.swapSteps ?? [])];
      steps[index] = step;
      return { ...current, swapSteps: steps };
    });
  });

  const backupBytes = await estimateBackupBytes(targetDb, latestCheckpoints);

  await callbacks.updateJob((current) => ({
    ...current,
    status: "completed",
    completedAt: new Date().toISOString(),
    error: null,
    interruptedReason: null,
    resumable: true,
    backupBytesEstimate: backupBytes,
    checkpoints: (current.checkpoints ?? []).map((checkpoint) => ({
      ...checkpoint,
      status: "swapped" as const,
    })),
  }));
  await callbacks.log("info", "Copy job completed.");
  return { outcome: "completed" as const };
}

export async function cleanupStagingOnCancel(
  targetClient: MongoClient,
  targetDatabase: string,
  job: CopyJob,
) {
  if (job.mode === "append") {
    return;
  }

  if (job.status === "swapping" || job.status === "completed" || job.status === "reverted") {
    return;
  }

  const targetDb = targetClient.db(targetDatabase);
  await dropStagingCollections(targetDb, job.checkpoints ?? []);
}
