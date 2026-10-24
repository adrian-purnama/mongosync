import type { Collection, Db, Document, IndexDescription } from "mongodb";

export type CollectionCreateOptions = {
  capped?: boolean;
  size?: number;
  max?: number;
  validator?: Document;
  validationLevel?: string;
  validationAction?: string;
  collation?: Document;
  timeseries?: Document;
  expireAfterSeconds?: number;
  clusteredIndex?: Document;
  changeStreamPreAndPostImages?: Document;
};

export async function readSourceCollectionOptions(
  db: Db,
  collectionName: string,
): Promise<CollectionCreateOptions> {
  const listed = await db
    .listCollections({ name: collectionName }, { nameOnly: false })
    .toArray();
  const info = listed[0] as { options?: CollectionCreateOptions } | undefined;
  return info?.options ?? {};
}

export async function readSourceIndexes(
  collection: Collection<Document>,
): Promise<IndexDescription[]> {
  const indexes = await collection.listIndexes().toArray();
  return indexes
    .filter((index) => index.name !== "_id_")
    .map((index) => {
      const description: IndexDescription = {
        key: index.key,
        name: index.name,
      };

      if (typeof index.unique === "boolean") description.unique = index.unique;
      if (typeof index.sparse === "boolean") description.sparse = index.sparse;
      if (typeof index.expireAfterSeconds === "number") {
        description.expireAfterSeconds = index.expireAfterSeconds;
      }
      if (index.partialFilterExpression) {
        description.partialFilterExpression = index.partialFilterExpression;
      }
      if (index.collation) description.collation = index.collation;
      if (index.wildcardProjection) {
        description.wildcardProjection = index.wildcardProjection;
      }
      if (typeof index.hidden === "boolean") description.hidden = index.hidden;
      if (index.storageEngine) description.storageEngine = index.storageEngine;

      return description;
    });
}

export async function ensureCollectionWithOptions(
  db: Db,
  collectionName: string,
  options: CollectionCreateOptions,
) {
  const existing = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  if (existing.length > 0) {
    return db.collection(collectionName);
  }

  const createOptions: Record<string, unknown> = {};
  if (options.capped) {
    createOptions.capped = true;
    if (options.size != null) createOptions.size = options.size;
    if (options.max != null) createOptions.max = options.max;
  }
  if (options.validator) createOptions.validator = options.validator;
  if (options.validationLevel) createOptions.validationLevel = options.validationLevel;
  if (options.validationAction) createOptions.validationAction = options.validationAction;
  if (options.collation) createOptions.collation = options.collation;
  if (options.timeseries) createOptions.timeseries = options.timeseries;
  if (options.expireAfterSeconds != null) {
    createOptions.expireAfterSeconds = options.expireAfterSeconds;
  }
  if (options.clusteredIndex) createOptions.clusteredIndex = options.clusteredIndex;
  if (options.changeStreamPreAndPostImages) {
    createOptions.changeStreamPreAndPostImages = options.changeStreamPreAndPostImages;
  }

  try {
    await db.createCollection(collectionName, createOptions);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 48) {
      throw error;
    }
  }

  return db.collection(collectionName);
}

export async function createIndexesAfterData(
  collection: Collection<Document>,
  indexes: IndexDescription[],
) {
  if (indexes.length === 0) {
    return;
  }

  await collection.createIndexes(indexes);
}
