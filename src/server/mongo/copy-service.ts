import { randomUUID } from "node:crypto";

import type { Filter, Document, InsertManyResult } from "mongodb";

import { COPY_BATCH_SIZE } from "@/src/server/config/constants";
import { getConnectionById, decryptConnectionUrl } from "@/src/server/connections/connection-service";
import { AppError } from "@/src/server/utils/errors";
import { createMongoClient } from "./mongo-client-factory";
import {
  addCopyJobLog,
  createCopyJob,
  getCopyJob,
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

export async function startCopyJob(input: StartCopyJobInput) {
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

  const jobId = randomUUID();
  if (input.mode === "new" && input.sourceCollections.length !== 1) {
    throw new AppError(
      "Copy to new collection supports exactly one source collection at a time.",
      400,
    );
  }

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
  });
  await addCopyJobLog(jobId, "info", "Queued. Waiting to start the copy job.");

  void runCopyJob({
    ...input,
    sourceCollections,
    targetCollections,
    sourceConnection,
    targetConnection,
    jobId,
  });

  return getCopyJob(jobId);
}

async function runCopyJob(
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

  await addCopyJobLog(input.jobId, "info", "Establishing source and target connections...");
  const sourceClient = await createMongoClient(sourceUri);
  const targetClient = await createMongoClient(targetUri);

  try {
    const startingJob = await getCopyJob(input.jobId);
    if (!startingJob || startingJob.status === "cancelled") {
      return;
    }

    await updateCopyJob(input.jobId, (job) => ({
      ...job,
      status: "running",
      interruptedReason: null,
      error: null,
    }));
    await addCopyJobLog(input.jobId, "info", "Connections established.");

    const sourceDb = sourceClient.db(input.sourceDatabase);
    const targetDb = targetClient.db(input.targetDatabase);
    const filter = (input.filter ?? {}) as Filter<Document>;
    let totalDocuments = 0;

    for (const sourceCollectionName of input.sourceCollections) {
      await throwIfCancellationRequested(input.jobId);
      totalDocuments += await sourceDb
        .collection(sourceCollectionName)
        .countDocuments(filter);
    }

    await updateCopyJob(input.jobId, (job) => ({ ...job, totalDocuments }));
    await addCopyJobLog(
      input.jobId,
      "info",
      `Found ${totalDocuments} documents to process.`,
    );

    let processedDocuments = 0;

    for (const [index, sourceCollectionName] of input.sourceCollections.entries()) {
      await throwIfCancellationRequested(input.jobId);
      const targetCollectionName = input.targetCollections[index];
      const sourceCollection = sourceDb.collection(sourceCollectionName);
      const targetCollection = targetDb.collection(targetCollectionName);

      await addCopyJobLog(
        input.jobId,
        "info",
        `Copying ${sourceCollectionName} to ${targetCollectionName}.`,
      );

      if (input.mode === "override") {
        await throwIfCancellationRequested(input.jobId);
        await targetCollection.deleteMany({});
        await addCopyJobLog(
          input.jobId,
          "warning",
          `Cleared target collection ${targetCollectionName} before copy.`,
        );
      }

      const cursor = sourceCollection.find(filter, {
        batchSize: COPY_BATCH_SIZE,
      });

      if (input.limit) {
        cursor.limit(input.limit);
      }

      let batch: Document[] = [];

      for await (const document of cursor) {
        await throwIfCancellationRequested(input.jobId);
        batch.push(document);

        if (batch.length >= COPY_BATCH_SIZE) {
          processedDocuments += await flushBatch(
            input.jobId,
            targetCollection,
            batch,
            input.mode,
          );
          batch = [];
        }
      }

      if (batch.length > 0) {
        await throwIfCancellationRequested(input.jobId);
        processedDocuments += await flushBatch(
          input.jobId,
          targetCollection,
          batch,
          input.mode,
        );
      }
    }

    await updateCopyJob(input.jobId, (job) => ({
      ...job,
      status: "completed",
      processedDocuments,
      completedAt: new Date().toISOString(),
    }));
    await addCopyJobLog(input.jobId, "info", "Copy job completed.");
  } catch (error) {
    if (error instanceof CancellationRequestedError) {
      await updateCopyJob(input.jobId, (job) => ({
        ...job,
        status: "cancelled",
        interruptedReason: "user_cancelled",
        completedAt: new Date().toISOString(),
        error: null,
      }));
      await addCopyJobLog(input.jobId, "warning", "Copy job cancelled safely.");
      return;
    }

    await updateCopyJob(input.jobId, (job) => ({
      ...job,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date().toISOString(),
    }));
    await addCopyJobLog(
      input.jobId,
      "error",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
}

class CancellationRequestedError extends Error {
  constructor() {
    super("Job cancellation requested.");
  }
}

async function throwIfCancellationRequested(jobId: string) {
  const job = await getCopyJob(jobId);

  if (job?.cancelRequestedAt) {
    throw new CancellationRequestedError();
  }
}

async function flushBatch(
  jobId: string,
  targetCollection: {
    insertMany: (
      docs: Document[],
      options: { ordered: boolean },
    ) => Promise<InsertManyResult<Document>>;
  },
  batch: Document[],
  mode: "override" | "append" | "new",
) {
  try {
    await targetCollection.insertMany(batch, {
      ordered: mode !== "append",
    });
  } catch (error) {
    if (!(mode === "append" && error instanceof Error)) {
      throw error;
    }

    await addCopyJobLog(
      jobId,
      "warning",
      "Append mode skipped one or more duplicate documents in a batch.",
    );
  }

  await updateCopyJob(jobId, (job) => ({
    ...job,
    processedDocuments: job.processedDocuments + batch.length,
  }));

  return batch.length;
}
