import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import type { Document } from "mongodb";

import { decryptConnectionUrl, getConnectionById } from "@/src/server/connections/connection-service";
import { persistJobArtifact } from "@/src/server/jobs/job-store";
import { AppError } from "@/src/server/utils/errors";
import {
  addCopyJobLog,
  createExportJob,
  getCopyJob,
  updateCopyJob,
} from "./copy-job-store";
import { createMongoClient } from "./mongo-client-factory";

type ExportDatabaseInput = {
  organizationId: string;
  sourceConnectionId: string;
  sourceDatabase: string;
  sourceCollections?: string[];
  password: string;
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
    artifactFileName: `${sanitizeFileName(input.sourceDatabase)}.zip`,
  });
  await addCopyJobLog(jobId, "info", "Queued. Waiting to start the export job.");

  void runExportJob({
    ...input,
    jobId,
    sourceConnection,
    sourceCollections,
  });

  return getCopyJob(jobId);
}

export async function exportDatabaseAsZipJson(input: ExportDatabaseInput) {
  const sourceConnection = await getConnectionById(input.sourceConnectionId);

  if (!sourceConnection) {
    throw new AppError("Source connection was not found.", 404);
  }

  if (sourceConnection.organizationId !== input.organizationId) {
    throw new AppError("Connection must belong to the selected organization.");
  }

  const sourceUri = decryptConnectionUrl(sourceConnection, input.password);
  const client = await createMongoClient(sourceUri);

  try {
    const db = client.db(input.sourceDatabase);
    const selectedCollections = input.sourceCollections?.filter(Boolean) ?? [];
    const collectionNames =
      selectedCollections.length > 0
        ? selectedCollections
        : (await db.listCollections({}, { nameOnly: true }).toArray())
            .map((collection) => collection.name)
            .sort();

    if (collectionNames.length === 0) {
      throw new AppError("No collections found to export.", 404);
    }

    const totalDocuments = await countDocuments(db, collectionNames);
    const zip = await buildExportZip(db, collectionNames);
    const fileName = `${sanitizeFileName(input.sourceDatabase)}.zip`;
    const content = await zip.generateAsync({ type: "uint8array" });

    return {
      fileName,
      content,
      totalDocuments,
    };
  } finally {
    await client.close();
  }
}

async function runExportJob(
  input: ExportDatabaseInput & {
    jobId: string;
    sourceConnection: NonNullable<Awaited<ReturnType<typeof getConnectionById>>>;
    sourceCollections: string[];
  },
) {
  const sourceUri = decryptConnectionUrl(input.sourceConnection, input.password);
  await addCopyJobLog(input.jobId, "info", "Establishing source connection...");
  const client = await createMongoClient(sourceUri);

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
    await addCopyJobLog(input.jobId, "info", "Source connection established.");

    const db = client.db(input.sourceDatabase);
    const collectionNames =
      input.sourceCollections.length > 0
        ? input.sourceCollections
        : (await db.listCollections({}, { nameOnly: true }).toArray())
            .map((collection) => collection.name)
            .sort();

    if (collectionNames.length === 0) {
      throw new AppError("No collections found to export.", 404);
    }

    await throwIfCancellationRequested(input.jobId);
    const totalDocuments = await countDocuments(db, collectionNames);
    await updateCopyJob(input.jobId, (job) => ({
      ...job,
      totalDocuments,
      sourceCollections: collectionNames,
      sourceCollection:
        collectionNames.length === 1
          ? collectionNames[0]
          : `${collectionNames.length} collections`,
    }));
    await addCopyJobLog(
      input.jobId,
      "info",
      `Preparing export for ${collectionNames.length} collection(s) and ${totalDocuments} document(s).`,
    );

    let processedDocuments = 0;
    const zip = await buildExportZip(db, collectionNames, async (processedIncrement, collectionName) => {
      await throwIfCancellationRequested(input.jobId);
      processedDocuments += processedIncrement;
      await updateCopyJob(input.jobId, (job) => ({
        ...job,
        processedDocuments,
      }));
      await addCopyJobLog(
        input.jobId,
        "info",
        `Exported ${processedIncrement} document(s) from ${collectionName}.`,
      );
    });
    await throwIfCancellationRequested(input.jobId);
    const artifactContent = await zip.generateAsync({ type: "uint8array" });
    await persistJobArtifact(input.jobId, artifactContent);

    await updateCopyJob(input.jobId, (job) => ({
      ...job,
      status: "completed",
      processedDocuments,
      completedAt: new Date().toISOString(),
      artifactStoredAt: new Date().toISOString(),
      resultAvailable: true,
    }));
    await addCopyJobLog(input.jobId, "info", "Export job completed.");
  } catch (error) {
    if (error instanceof CancellationRequestedError) {
      await updateCopyJob(input.jobId, (job) => ({
        ...job,
        status: "cancelled",
        interruptedReason: "user_cancelled",
        completedAt: new Date().toISOString(),
        error: null,
      }));
      await addCopyJobLog(input.jobId, "warning", "Export job cancelled safely.");
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
    await client.close();
  }
}

async function countDocuments(
  db: {
    collection: (
      name: string,
    ) => {
      countDocuments?: (filter: Record<string, never>) => Promise<number>;
      find: (filter: Record<string, never>) => { toArray: () => Promise<Document[]> };
    };
  },
  collectionNames: string[],
) {
  let totalDocuments = 0;

  for (const collectionName of collectionNames) {
    const collection = db.collection(collectionName);
    if (collection.countDocuments) {
      totalDocuments += await collection.countDocuments({});
      continue;
    }

    totalDocuments += (await collection.find({}).toArray()).length;
  }

  return totalDocuments;
}

async function buildExportZip(
  db: {
    collection: (name: string) => { find: (filter: Record<string, never>) => { toArray: () => Promise<Document[]> } };
  },
  collectionNames: string[],
  onCollectionExported?: (processedIncrement: number, collectionName: string) => Promise<void>,
) {
  const zip = new JSZip();

  for (const collectionName of collectionNames) {
    const documents = await db.collection(collectionName).find({}).toArray();
    const serializedDocuments = documents.map((document) => toJsonSafeValue(document));
    zip.file(`${collectionName}.json`, JSON.stringify(serializedDocuments, null, 2));

    if (onCollectionExported) {
      await onCollectionExported(documents.length, collectionName);
    }
  }

  return zip;
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

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-");
}

function toJsonSafeValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafeValue(entry));
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object") {
    const document = value as Document & { _bsontype?: string; toHexString?: () => string };

    if (document._bsontype === "ObjectId" && typeof document.toHexString === "function") {
      return document.toHexString();
    }

    if (
      ["Decimal128", "Long", "Int32", "Double", "Timestamp"].includes(
        document._bsontype ?? "",
      ) &&
      typeof document.toString === "function"
    ) {
      return document.toString();
    }

    if (document._bsontype === "Binary" && "buffer" in document) {
      return Buffer.from(
        document.buffer as ArrayBufferLike,
      ).toString("base64");
    }

    return Object.fromEntries(
      Object.entries(document).map(([key, nestedValue]) => [
        key,
        toJsonSafeValue(nestedValue),
      ]),
    );
  }

  return String(value);
}
