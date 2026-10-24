import type { CollectionCheckpoint, CopyJob } from "@/src/types/models";
import {
  BACKUP_SUFFIX_PREFIX,
  STAGING_SUFFIX_PREFIX,
} from "@/src/server/mongo/copy-config";

export function stagingCollectionName(targetCollection: string, jobId: string) {
  return `${targetCollection}${STAGING_SUFFIX_PREFIX}${jobId}`;
}

export function backupCollectionName(targetCollection: string, jobId: string) {
  return `${targetCollection}${BACKUP_SUFFIX_PREFIX}${jobId}`;
}

export function buildInitialCheckpoints(
  sourceCollections: string[],
  targetCollections: string[],
  jobId: string,
  mode: "override" | "append" | "new",
): CollectionCheckpoint[] {
  return sourceCollections.map((sourceCollection, index) => {
    const targetCollection = targetCollections[index] ?? sourceCollection;
    const stagingCollection =
      mode === "append"
        ? targetCollection
        : stagingCollectionName(targetCollection, jobId);

    return {
      sourceCollection,
      targetCollection,
      stagingCollection,
      backupCollection:
        mode === "override" ? backupCollectionName(targetCollection, jobId) : null,
      lastId: null,
      docsCopied: 0,
      bytesCopied: 0,
      status: "pending",
      indexesCreated: false,
    };
  });
}

export function sumCheckpointDocs(checkpoints: CollectionCheckpoint[] | undefined) {
  return (checkpoints ?? []).reduce((sum, checkpoint) => sum + checkpoint.docsCopied, 0);
}

export function sumCheckpointBytes(checkpoints: CollectionCheckpoint[] | undefined) {
  return (checkpoints ?? []).reduce((sum, checkpoint) => sum + checkpoint.bytesCopied, 0);
}

export function updateCheckpoint(
  job: CopyJob,
  sourceCollection: string,
  patch: Partial<CollectionCheckpoint>,
): CollectionCheckpoint[] {
  const checkpoints = [...(job.checkpoints ?? [])];
  const index = checkpoints.findIndex(
    (checkpoint) => checkpoint.sourceCollection === sourceCollection,
  );

  if (index < 0) {
    throw new Error(`Missing checkpoint for collection ${sourceCollection}.`);
  }

  checkpoints[index] = {
    ...checkpoints[index],
    ...patch,
  };

  return checkpoints;
}

export function serializeLastId(value: unknown): unknown {
  if (value == null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }

  if (typeof value === "object" && value !== null && "_bsontype" in value) {
    const bson = value as { _bsontype?: string; toHexString?: () => string; toString?: () => string };
    if (bson._bsontype === "ObjectId" && typeof bson.toHexString === "function") {
      return { $oid: bson.toHexString() };
    }
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}
