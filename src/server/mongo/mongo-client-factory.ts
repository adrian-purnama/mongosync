import { MongoClient } from "mongodb";

export async function createMongoClient(uri: string) {
  const client = new MongoClient(uri, {
    retryWrites: true,
    serverSelectionTimeoutMS: 5000,
  });

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
