import { EJSON } from "bson";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import type { Document, IndexDescription, MongoClient } from "mongodb";

import { BATCH_DOCS } from "@/src/server/mongo/copy-config";
import { InflightWriteGate } from "@/src/server/mongo/copy/batching";
import { CancellationRequestedError } from "@/src/server/mongo/copy/engine";
import {
  createIndexesAfterData,
  ensureCollectionWithOptions,
  type CollectionCreateOptions,
} from "@/src/server/mongo/copy/indexes";
import {
  backupCollectionName,
  stagingCollectionName,
} from "@/src/server/mongo/copy/checkpoint";
import {
  buildReplaceSwapSteps,
  dropStagingCollections,
  executeSwapSteps,
} from "@/src/server/mongo/copy/staging";
import { isDuplicateKeyError } from "@/src/server/mongo/util/retry";
import { AppError } from "@/src/server/utils/errors";
import type { CollectionCheckpoint } from "@/src/types/models";

export async function streamImportZip(input: {
  filePath: string;
  targetClient: MongoClient;
  targetDatabase: string;
  jobId: string;
  signal: AbortSignal;
  onProgress: (processed: number) => Promise<void>;
  log: (level: "info" | "warning" | "error", message: string) => Promise<unknown>;
}) {
  const raw = await readFile(input.filePath);
  const zip = await JSZip.loadAsync(raw);
  const db = input.targetClient.db(input.targetDatabase);
  const checkpoints: CollectionCheckpoint[] = [];

  try {
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      throw new AppError("ZIP is missing manifest.json.", 400);
    }

    const manifest = JSON.parse(await manifestFile.async("string")) as {
      collections?: Array<{ name: string }>;
    };

    const collectionNames =
      manifest.collections?.map((entry) => entry.name).filter(Boolean) ??
      Object.keys(zip.files)
        .map((name) => name.split("/")[0])
        .filter((name, index, all) => Boolean(name) && all.indexOf(name) === index && name !== "manifest.json");

    if (collectionNames.length === 0) {
      throw new AppError("ZIP contains no collections to import.", 400);
    }

    let processed = 0;

    for (const collectionName of collectionNames) {
      if (input.signal.aborted) {
        throw new CancellationRequestedError();
      }

      const dataFile = zip.file(`${collectionName}/data.ndjson`);
      if (!dataFile) {
        throw new AppError(`ZIP is missing ${collectionName}/data.ndjson.`, 400);
      }

      let options: CollectionCreateOptions = {};
      let indexes: IndexDescription[] = [];
      const metaFile = zip.file(`${collectionName}/metadata.json`);
      if (metaFile) {
        const metadata = JSON.parse(await metaFile.async("string")) as {
          options?: CollectionCreateOptions;
          indexes?: IndexDescription[];
        };
        options = metadata.options ?? {};
        indexes = metadata.indexes ?? [];
      }

      const staging = stagingCollectionName(collectionName, input.jobId);
      await ensureCollectionWithOptions(db, staging, options);
      const target = db.collection(staging);
      const gate = new InflightWriteGate();
      let batch: Document[] = [];

      await input.log("info", `Importing ${collectionName} into staging.`);

      const ndjson = await dataFile.async("string");
      const lines = ndjson.split(/\r?\n/);

      const flush = async () => {
        if (batch.length === 0) {
          return;
        }
        const docs = batch;
        batch = [];
        await gate.enqueue(async () => {
          try {
            await target.insertMany(docs, {
              ordered: false,
              bypassDocumentValidation: true,
              writeConcern: { w: 1 },
            });
          } catch (error) {
            if (!isDuplicateKeyError(error)) {
              throw error;
            }
          }
          processed += docs.length;
          await input.onProgress(processed);
        });
      };

      for (const line of lines) {
        if (input.signal.aborted) {
          throw new CancellationRequestedError();
        }
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        batch.push(EJSON.parse(trimmed) as Document);
        if (batch.length >= BATCH_DOCS) {
          await flush();
        }
      }

      await flush();
      await gate.drain();
      await createIndexesAfterData(target, indexes);

      checkpoints.push({
        sourceCollection: collectionName,
        targetCollection: collectionName,
        stagingCollection: staging,
        backupCollection: backupCollectionName(collectionName, input.jobId),
        lastId: null,
        docsCopied: processed,
        bytesCopied: 0,
        status: "indexed",
        indexesCreated: true,
      });
    }

    const swapSteps = buildReplaceSwapSteps(checkpoints);
    await executeSwapSteps(db, swapSteps, async () => undefined);

    return {
      processedDocuments: processed,
      collections: collectionNames,
      checkpoints: checkpoints.map((checkpoint) => ({
        ...checkpoint,
        status: "swapped" as const,
      })),
    };
  } catch (error) {
    await dropStagingCollections(db, checkpoints).catch(() => undefined);
    throw error;
  }
}
