import { MongoClient } from "mongodb";
import { AppError } from "@/src/server/utils/errors";

const MONGO_SERVER_SELECTION_TIMEOUT_MS = 15_000;

export async function createMongoClient(uri: string) {
  const client = new MongoClient(uri, {
    retryWrites: true,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close().catch(() => undefined);

    const message =
      error instanceof Error ? error.message : "Unknown MongoDB connection error.";

    throw new AppError(
      `Unable to reach the MongoDB server. Check the connection string, network access, DNS/VPN settings, and whether the cluster is awake. Details: ${message}`,
      400,
    );
  }
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
