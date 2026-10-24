import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { PassThrough } from "node:stream";

import { EJSON } from "bson";
import type { Db, Document, MongoClient } from "mongodb";

import { BATCH_DOCS, EXPORT_ZLIB_LEVEL } from "@/src/server/mongo/copy-config";
import {
  readSourceCollectionOptions,
  readSourceIndexes,
} from "@/src/server/mongo/copy/indexes";
import { AppError } from "@/src/server/utils/errors";
import {
  ensureJobArtifactsDirectory,
  getJobArtifactPath,
} from "@/src/server/jobs/job-files";

const nodeRequire = createRequire(path.join(process.cwd(), "package.json"));
type ArchiverInstance = {
  append: (
    source: NodeJS.ReadableStream | Buffer | string,
    data?: { name: string },
  ) => unknown;
  finalize: () => Promise<void>;
  abort: () => void;
  pipe: (destination: NodeJS.WritableStream) => NodeJS.WritableStream;
  on: (event: string, listener: (...args: never[]) => void) => unknown;
};

type ArchiverModule = {
  ZipArchive: new (options?: { zlib?: { level?: number } }) => ArchiverInstance;
};

function createZipArchive(options?: { zlib?: { level?: number } }): ArchiverInstance {
  const mod = nodeRequire("archiver") as ArchiverModule;
  return new mod.ZipArchive(options);
}

export class ExportCancellationError extends Error {
  constructor() {
    super("Export cancelled.");
    this.name = "ExportCancellationError";
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new ExportCancellationError();
  }
}

export type StreamExportProgress = {
  processedDocuments: number;
  processedBytes: number;
  collectionName?: string;
};

async function appendCollectionNdjson(
  archive: ArchiverInstance,
  db: Db,
  collectionName: string,
  signal: AbortSignal | undefined,
  onProgress: (docs: number, bytes: number) => void,
) {
  const collection = db.collection(collectionName);
  const pass = new PassThrough();
  const hash = createHash("sha256");
  let collectionDocs = 0;
  let batchDocs = 0;
  let batchBytes = 0;

  const appendDone = new Promise<void>((resolve, reject) => {
    pass.on("end", () => resolve());
    pass.on("error", reject);
  });

  archive.append(pass, { name: `${collectionName}/data.ndjson` });

  const cursor = collection.find({}, { batchSize: BATCH_DOCS, sort: { _id: 1 } });

  try {
    for await (const document of cursor) {
      throwIfAborted(signal);
      const line = `${EJSON.stringify(document as Document, { relaxed: false })}\n`;
      const buffer = Buffer.from(line);
      hash.update(buffer);
      collectionDocs += 1;
      batchDocs += 1;
      batchBytes += buffer.length;

      if (!pass.write(buffer)) {
        await new Promise<void>((resolve) => pass.once("drain", resolve));
      }

      if (batchDocs >= BATCH_DOCS) {
        onProgress(batchDocs, batchBytes);
        batchDocs = 0;
        batchBytes = 0;
      }
    }

    if (batchDocs > 0 || batchBytes > 0) {
      onProgress(batchDocs, batchBytes);
    }
  } finally {
    await cursor.close().catch(() => undefined);
    pass.end();
  }

  await appendDone;

  return {
    documents: collectionDocs,
    sha256: hash.digest("hex"),
  };
}

export async function streamExportDatabaseToZip(input: {
  client: MongoClient;
  databaseName: string;
  collectionNames: string[];
  connectionLabel: string;
  appVersion: string;
  outputPath: string;
  signal?: AbortSignal;
  onProgress?: (progress: StreamExportProgress) => Promise<void> | void;
}) {
  await ensureJobArtifactsDirectory();
  const partialPath = `${input.outputPath}.partial`;
  await rm(partialPath, { force: true }).catch(() => undefined);
  await rm(input.outputPath, { force: true }).catch(() => undefined);

  const db = input.client.db(input.databaseName);
  const archive = createZipArchive({ zlib: { level: EXPORT_ZLIB_LEVEL } });
  const output = createWriteStream(partialPath);

  const archiveDone = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.on("warning", (warning: Error & { code?: string }) => {
      if (warning.code !== "ENOENT") {
        reject(warning);
      }
    });
  });

  archive.pipe(output);

  let processedDocuments = 0;
  let processedBytes = 0;
  const collectionSummaries: Array<{
    name: string;
    documents: number;
    sha256: string;
  }> = [];

  try {
    for (const collectionName of input.collectionNames) {
      throwIfAborted(input.signal);

      await input.onProgress?.({
        processedDocuments,
        processedBytes,
        collectionName,
      });

      const options = await readSourceCollectionOptions(db, collectionName);
      const indexes = await readSourceIndexes(db.collection(collectionName));

      const summary = await appendCollectionNdjson(
        archive,
        db,
        collectionName,
        input.signal,
        (docs, bytes) => {
          processedDocuments += docs;
          processedBytes += bytes;
          void input.onProgress?.({
            processedDocuments,
            processedBytes,
            collectionName,
          });
        },
      );

      archive.append(
        JSON.stringify(
          {
            name: collectionName,
            options,
            indexes,
          },
          null,
          2,
        ),
        { name: `${collectionName}/metadata.json` },
      );

      collectionSummaries.push({
        name: collectionName,
        documents: summary.documents,
        sha256: summary.sha256,
      });
    }

    const manifest = {
      appVersion: input.appVersion,
      connectionLabel: input.connectionLabel,
      database: input.databaseName,
      exportedAt: new Date().toISOString(),
      collections: collectionSummaries,
      totalDocuments: collectionSummaries.reduce((sum, entry) => sum + entry.documents, 0),
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
    await archive.finalize();
    await archiveDone;
    await rename(partialPath, input.outputPath);

    const fileStat = await stat(input.outputPath);
    return {
      filePath: input.outputPath,
      totalDocuments: manifest.totalDocuments,
      processedDocuments,
      processedBytes: fileStat.size,
      manifest,
    };
  } catch (error) {
    try {
      archive.abort();
    } catch {
      // ignore
    }
    await rm(partialPath, { force: true }).catch(() => undefined);
    await rm(input.outputPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function getExportArtifactFilePath(jobId: string) {
  return path.join(path.dirname(getJobArtifactPath(jobId)), `${jobId}.export.zip`);
}

export async function listExportableCollections(db: Db, selected?: string[]) {
  if (selected && selected.length > 0) {
    return selected;
  }

  return (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith("_mongosync_"))
    .sort();
}

export async function estimateExportDocuments(db: Db, collectionNames: string[]) {
  let total = 0;
  for (const name of collectionNames) {
    total += await db.collection(name).estimatedDocumentCount();
  }
  return total;
}

export function sanitizeExportFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-");
}

export async function detectMongodumpOnPath(): Promise<string | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("where", ["mongodump"]);
      const first = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      return first ?? null;
    }

    const { stdout } = await execFileAsync("which", ["mongodump"]);
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first ?? null;
  } catch {
    return null;
  }
}

export async function runMongodumpExport(input: {
  mongoUri: string;
  databaseName: string;
  outputPath: string;
  signal?: AbortSignal;
}) {
  const mongodump = await detectMongodumpOnPath();
  if (!mongodump) {
    throw new AppError("mongodump was not found on PATH.", 400);
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const partialPath = `${input.outputPath}.partial`;

  await rm(partialPath, { force: true }).catch(() => undefined);
  throwIfAborted(input.signal);

  await execFileAsync(
    mongodump,
    [
      `--uri=${input.mongoUri}`,
      `--db=${input.databaseName}`,
      `--archive=${partialPath}`,
      "--gzip",
    ],
    { windowsHide: true },
  );

  await rename(partialPath, input.outputPath);
  return { filePath: input.outputPath };
}
