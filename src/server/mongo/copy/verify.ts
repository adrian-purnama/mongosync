import { createHash } from "node:crypto";

import { EJSON } from "bson";
import type { Collection, Db, Document } from "mongodb";

import { VERIFY_SAMPLE_SIZE } from "@/src/server/mongo/copy-config";
import type { CollectionCheckpoint } from "@/src/types/models";
import { AppError } from "@/src/server/utils/errors";

function hashDocument(document: Document) {
  const canonical = EJSON.stringify(document, { relaxed: false });
  return createHash("sha256").update(canonical).digest("hex");
}

async function sampleHashes(
  collection: Collection<Document>,
  sampleSize: number,
): Promise<Map<string, string>> {
  const total = await collection.estimatedDocumentCount();
  if (total === 0) {
    return new Map();
  }

  const samples = await collection
    .aggregate<Document>([{ $sample: { size: Math.min(sampleSize, total) } }])
    .toArray();

  const hashes = new Map<string, string>();
  for (const document of samples) {
    const idKey = EJSON.stringify(document._id, { relaxed: false });
    hashes.set(idKey, hashDocument(document));
  }

  return hashes;
}

export async function verifyCollectionPair(
  sourceDb: Db,
  targetDb: Db,
  checkpoint: CollectionCheckpoint,
  filter: Document,
) {
  const source = sourceDb.collection(checkpoint.sourceCollection);
  const staging = targetDb.collection(checkpoint.stagingCollection);

  const [sourceCount, stagingCount] = await Promise.all([
    Object.keys(filter).length === 0
      ? source.estimatedDocumentCount()
      : source.countDocuments(filter),
    staging.countDocuments({}),
  ]);

  if (sourceCount !== stagingCount) {
    throw new AppError(
      `Verification failed for ${checkpoint.sourceCollection}: source count ${sourceCount} != staging count ${stagingCount}.`,
      409,
    );
  }

  if (sourceCount === 0) {
    return { sourceCount, stagingCount, sampleChecked: 0 };
  }

  const sourceHashes = await sampleHashes(source, VERIFY_SAMPLE_SIZE);
  let sampleChecked = 0;

  for (const [idKey, sourceHash] of sourceHashes) {
    const id = EJSON.parse(idKey) as Document;
    const stagingDoc = await staging.findOne({ _id: id as never });
    if (!stagingDoc) {
      throw new AppError(
        `Verification failed for ${checkpoint.sourceCollection}: sampled document missing in staging.`,
        409,
      );
    }

    const stagingHash = hashDocument(stagingDoc);
    if (stagingHash !== sourceHash) {
      throw new AppError(
        `Verification failed for ${checkpoint.sourceCollection}: sampled document hash mismatch.`,
        409,
      );
    }

    sampleChecked += 1;
  }

  return { sourceCount, stagingCount, sampleChecked };
}

export async function verifyAllCollections(
  sourceDb: Db,
  targetDb: Db,
  checkpoints: CollectionCheckpoint[],
  filter: Document,
) {
  for (const checkpoint of checkpoints) {
    await verifyCollectionPair(sourceDb, targetDb, checkpoint, filter);
  }
}
