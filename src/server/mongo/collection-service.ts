import { AppError } from "@/src/server/utils/errors";
import { createMongoClient } from "./mongo-client-factory";

export async function listDatabasesFromMongo(uri: string) {
  const client = await createMongoClient(uri);

  try {
    const admin = client.db().admin();
    const result = await admin.listDatabases();

    return result.databases
      .map((database) => database.name)
      .filter((name) => !["admin", "config", "local"].includes(name))
      .sort();
  } finally {
    await client.close();
  }
}

export async function listCollectionsFromMongo(uri: string, databaseName: string) {
  if (!databaseName.trim()) {
    throw new AppError("Database name is required to list collections.", 400);
  }

  const client = await createMongoClient(uri);

  try {
    const db = client.db(databaseName);
    const collections = await db
      .listCollections({}, { nameOnly: true })
      .toArray();

    return collections.map((collection) => collection.name).sort();
  } finally {
    await client.close();
  }
}
