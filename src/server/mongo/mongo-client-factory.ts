import { createRequire } from "node:module";
import path from "node:path";

import { MongoClient, type MongoClientOptions, ReadPreference } from "mongodb";

import {
  MONGO_MAX_POOL_SIZE,
  MONGO_SERVER_SELECTION_TIMEOUT_MS,
  MONGO_SOCKET_TIMEOUT_MS,
} from "@/src/server/mongo/copy-config";

/**
 * Probe optional native compressors at runtime without letting Turbopack
 * statically bundle them into the Next.js ESM graph.
 */
function resolveCompressors(): Array<"zstd" | "snappy" | "zlib"> {
  const compressors: Array<"zstd" | "snappy" | "zlib"> = [];
  const nodeRequire = createRequire(
    path.join(/* turbopackIgnore: true */ process.cwd(), "package.json"),
  );

  for (const candidate of [
    { id: "@mongodb-js/" + "zstd", name: "zstd" as const },
    { id: "snap" + "py", name: "snappy" as const },
  ]) {
    try {
      nodeRequire(candidate.id);
      compressors.push(candidate.name);
    } catch {
      // optional native addon — fall through to zlib
    }
  }

  compressors.push("zlib");
  return compressors;
}

export type CreateMongoClientOptions = {
  readPreference?: "primary" | "secondaryPreferred";
};

export async function createMongoClient(
  uri: string,
  options: CreateMongoClientOptions = {},
) {
  const clientOptions: MongoClientOptions = {
    maxPoolSize: MONGO_MAX_POOL_SIZE,
    compressors: resolveCompressors(),
    retryReads: true,
    retryWrites: true,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS,
    readPreference:
      options.readPreference === "secondaryPreferred"
        ? ReadPreference.secondaryPreferred
        : ReadPreference.primary,
  };

  const client = new MongoClient(uri, clientOptions);
  await client.connect();
  return client;
}

export async function verifyMongoConnection(uri: string) {
  const client = await createMongoClient(uri);

  try {
    await client.db().admin().command({ ping: 1 });
  } finally {
    await client.close();
  }
}

export function getDatabaseNameFromMongoUri(uri: string) {
  try {
    const normalized = uri.replace(/^mongodb\+srv:\/\//i, "https://").replace(
      /^mongodb:\/\//i,
      "https://",
    );
    const parsed = new URL(normalized);
    const databaseName = parsed.pathname.replace(/^\//, "").trim();

    return databaseName || null;
  } catch {
    return null;
  }
}
