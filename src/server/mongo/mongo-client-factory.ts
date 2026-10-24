import { MongoClient, type MongoClientOptions, ReadPreference } from "mongodb";

import {
  MONGO_MAX_POOL_SIZE,
  MONGO_SERVER_SELECTION_TIMEOUT_MS,
  MONGO_SOCKET_TIMEOUT_MS,
} from "@/src/server/mongo/copy-config";

function resolveCompressors(): Array<"zstd" | "snappy" | "zlib"> {
  const compressors: Array<"zstd" | "snappy" | "zlib"> = [];

  try {
    require("@mongodb-js/zstd");
    compressors.push("zstd");
  } catch {
    // optional
  }

  try {
    require("snappy");
    compressors.push("snappy");
  } catch {
    // optional
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
