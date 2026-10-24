import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";

import {
  decryptConnectionUrl,
  getConnectionById,
} from "@/src/server/connections/connection-service";
import { APP_NAME } from "@/src/server/config/constants";
import { AppError } from "@/src/server/utils/errors";
import {
  addCopyJobLog,
  createExportJob,
  createImportJob,
  getCopyJob,
  updateCopyJob,
} from "./copy-job-store";
import {
  clearJobAbortController,
  getOrCreateJobAbortController,
} from "./job-runtime";
import { createMongoClient } from "./mongo-client-factory";
import {
  detectMongodumpOnPath,
  estimateExportDocuments,
  ExportCancellationError,
  getExportArtifactFilePath,
  listExportableCollections,
  runMongodumpExport,
  sanitizeExportFileName,
  streamExportDatabaseToZip,
} from "./export/stream-export";
import { streamImportZip } from "./export/stream-import";
import {
  acquireJobLock,
  type AcquiredLock,
} from "./lock/job-lock";
import { CancellationRequestedError } from "./copy/engine";

type ExportDatabaseInput = {
  organizationId: string;
  sourceConnectionId: string;
  sourceDatabase: string;
  sourceCollections?: string[];
  password: string;
  useMongodump?: boolean;
};

type ImportZipInput = {
  organizationId: string;
  targetConnectionId: string;
  targetDatabase: string;
  password: string;
  filePath: string;
};

export async function startExportJob(input: ExportDatabaseInput) {
  const sourceConnection = await getConnectionById(input.sourceConnectionId);

  if (!sourceConnection) {
    throw new AppError("Source connection was not found.", 404);
  }

  if (sourceConnection.organizationId !== input.organizationId) {
    throw new AppError("Connection must belong to the selected organization.");
  }

  const jobId = randomUUID();
  const sourceCollections = input.sourceCollections?.filter(Boolean) ?? [];
  const sourceCollectionSummary =
    sourceCollections.length === 0
      ? "entire database"
      : sourceCollections.length === 1
        ? sourceCollections[0]
        : `${sourceCollections.length} collections`;

  await createExportJob({
    id: jobId,
    organizationId: input.organizationId,
    sourceConnectionId: input.sourceConnectionId,
    sourceDatabase: input.sourceDatabase,
    sourceCollection: sourceCollectionSummary,
    sourceCollections,
    artifactFileName: `${sanitizeExportFileName(input.sourceDatabase)}.zip`,
  });

  void runExportJob({
    ...input,
    jobId,
    sourceConnection,
    sourceCollections,
  });

  return getCopyJob(jobId);
}

async function runExportJob(
  input: ExportDatabaseInput & {
    jobId: string;
    sourceConnection: NonNullable<Awaited<ReturnType<typeof getConnectionById>>>;
    sourceCollections: string[];
  },
) {
  const sourceUri = decryptConnectionUrl(input.sourceConnection, input.password);
  const client = await createMongoClient(sourceUri, {
    readPreference: "secondaryPreferred",
  });
  const controller = getOrCreateJobAbortController(input.jobId);
  const outputPath = getExportArtifactFilePath(input.jobId);

  try {
    const startingJob = await getCopyJob(input.jobId);
    if (!startingJob || startingJob.status === "cancelled") {
      return;
    }

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
    await addCopyJobLog(input.jobId, "info", "Source connection established.");

    const db = client.db(input.sourceDatabase);
    const collectionNames = await listExportableCollections(db, input.sourceCollections);

    if (collectionNames.length === 0) {
      throw new AppError("No collections found to export.", 404);
    }

    const totalDocuments = await estimateExportDocuments(db, collectionNames);
    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        totalDocuments,
        sourceCollections: collectionNames,
        sourceCollection:
          collectionNames.length === 1
            ? collectionNames[0]
            : `${collectionNames.length} collections`,
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(
      input.jobId,
      "info",
      `Preparing export for ${collectionNames.length} collection(s) (~${totalDocuments} document(s)).`,
    );

    if (input.useMongodump) {
      await runMongodumpExport({
        mongoUri: sourceUri,
        databaseName: input.sourceDatabase,
        outputPath,
        signal: controller.signal,
      });
      await updateCopyJob(
        input.jobId,
        (job) => ({
          ...job,
          status: "completed",
          processedDocuments: totalDocuments,
          completedAt: new Date().toISOString(),
          artifactStoredAt: new Date().toISOString(),
          resultAvailable: true,
          artifactContentType: "application/gzip",
          artifactFileName: `${sanitizeExportFileName(input.sourceDatabase)}.archive.gz`,
        }),
        { forcePersist: true },
      );
      await addCopyJobLog(input.jobId, "info", "mongodump export completed.");
      return;
    }

    let lastProgressWrite = 0;
    await streamExportDatabaseToZip({
      client,
      databaseName: input.sourceDatabase,
      collectionNames,
      connectionLabel: input.sourceConnection.name,
      appVersion: APP_NAME,
      outputPath,
      signal: controller.signal,
      onProgress: async ({ processedDocuments, processedBytes }) => {
        const now = Date.now();
        if (now - lastProgressWrite < 500) {
          return;
        }
        lastProgressWrite = now;
        await updateCopyJob(input.jobId, (job) => ({
          ...job,
          processedDocuments,
          processedBytes,
        }));
      },
    });

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "completed",
        processedDocuments: totalDocuments,
        completedAt: new Date().toISOString(),
        artifactStoredAt: new Date().toISOString(),
        resultAvailable: true,
        artifactContentType: "application/zip",
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(input.jobId, "info", "Export job completed.");
  } catch (error) {
    if (
      error instanceof ExportCancellationError ||
      error instanceof CancellationRequestedError ||
      controller.signal.aborted
    ) {
      await rm(outputPath, { force: true }).catch(() => undefined);
      await rm(`${outputPath}.partial`, { force: true }).catch(() => undefined);
      await updateCopyJob(
        input.jobId,
        (job) => ({
          ...job,
          status: "cancelled",
          interruptedReason: "user_cancelled",
          completedAt: new Date().toISOString(),
          error: null,
          resultAvailable: false,
        }),
        { forcePersist: true },
      );
      await addCopyJobLog(input.jobId, "warning", "Export job cancelled safely.");
      return;
    }

    await rm(outputPath, { force: true }).catch(() => undefined);
    await rm(`${outputPath}.partial`, { force: true }).catch(() => undefined);
    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date().toISOString(),
        resultAvailable: false,
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(
      input.jobId,
      "error",
      error instanceof Error ? error.message : "Unknown error",
    );
  } finally {
    clearJobAbortController(input.jobId);
    await client.close();
  }
}

export async function loadExportArtifact(jobId: string) {
  const job = await getCopyJob(jobId);
  if (!job || job.kind !== "export" || !job.resultAvailable) {
    throw new AppError("Export artifact is not available.", 404);
  }

  const filePath = getExportArtifactFilePath(jobId);
  try {
    return {
      fileName: job.artifactFileName ?? `${jobId}.zip`,
      contentType: job.artifactContentType ?? "application/zip",
      content: await readFile(filePath),
    };
  } catch {
    throw new AppError("Export artifact file was not found.", 404);
  }
}

export async function getMongodumpAvailability() {
  const path = await detectMongodumpOnPath();
  return { available: Boolean(path), path };
}

export async function startImportJob(input: ImportZipInput) {
  const targetConnection = await getConnectionById(input.targetConnectionId);
  if (!targetConnection) {
    throw new AppError("Target connection was not found.", 404);
  }

  if (targetConnection.organizationId !== input.organizationId) {
    throw new AppError("Connection must belong to the selected organization.");
  }

  const jobId = randomUUID();
  await createImportJob({
    id: jobId,
    mode: "override",
    organizationId: input.organizationId,
    sourceConnectionId: input.targetConnectionId,
    targetConnectionId: input.targetConnectionId,
    sourceDatabase: input.targetDatabase,
    targetDatabase: input.targetDatabase,
    sourceCollection: "zip import",
    targetCollection: "zip import",
    sourceCollections: [],
    targetCollections: [],
    artifactFileName: input.filePath,
  });

  void runImportJob({ ...input, jobId, targetConnection });
  return getCopyJob(jobId);
}

async function runImportJob(
  input: ImportZipInput & {
    jobId: string;
    targetConnection: NonNullable<Awaited<ReturnType<typeof getConnectionById>>>;
  },
) {
  const targetUri = decryptConnectionUrl(input.targetConnection, input.password);
  const client = await createMongoClient(targetUri);
  const controller = getOrCreateJobAbortController(input.jobId);
  let acquiredLock: AcquiredLock | null = null;

  try {
    acquiredLock = await acquireJobLock({
      client,
      connectionId: input.targetConnectionId,
      database: input.targetDatabase,
      jobId: input.jobId,
    });

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "running",
        lock: acquiredLock?.info ?? null,
      }),
      { forcePersist: true },
    );

    const result = await streamImportZip({
      filePath: input.filePath,
      targetClient: client,
      targetDatabase: input.targetDatabase,
      jobId: input.jobId,
      signal: controller.signal,
      onProgress: async (processed) => {
        await updateCopyJob(input.jobId, (job) => ({
          ...job,
          processedDocuments: processed,
        }));
      },
      log: (level, message) => addCopyJobLog(input.jobId, level, message),
    });

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "completed",
        processedDocuments: result.processedDocuments,
        totalDocuments: result.processedDocuments,
        sourceCollections: result.collections,
        targetCollections: result.collections,
        checkpoints: result.checkpoints,
        completedAt: new Date().toISOString(),
        resumable: true,
      }),
      { forcePersist: true },
    );
    await addCopyJobLog(input.jobId, "info", "Import job completed.");
  } catch (error) {
    if (
      error instanceof CancellationRequestedError ||
      controller.signal.aborted
    ) {
      await updateCopyJob(
        input.jobId,
        (job) => ({
          ...job,
          status: "cancelled",
          interruptedReason: "user_cancelled",
          completedAt: new Date().toISOString(),
        }),
        { forcePersist: true },
      );
      return;
    }

    await updateCopyJob(
      input.jobId,
      (job) => ({
        ...job,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date().toISOString(),
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
    }
    clearJobAbortController(input.jobId);
    await client.close();
  }
}
