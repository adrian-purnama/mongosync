import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import type { Db, MongoClient } from "mongodb";

import {
  LOCK_COLLECTION,
  LOCK_HEARTBEAT_MS,
  LOCK_TTL_MS,
} from "@/src/server/mongo/copy-config";
import { AppError } from "@/src/server/utils/errors";
import type { JobLockInfo } from "@/src/types/models";

type LockDocument = {
  _id: string;
  jobId: string;
  owner: string;
  startedAt: Date;
  heartbeatAt: Date;
  expiresAt: Date;
};

const processOwnerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const inProcessLocks = new Map<string, string>();

function inProcessKey(connectionId: string, database: string) {
  return `${connectionId}:${database}`;
}

export function getLockOwnerId() {
  return processOwnerId;
}

async function ensureLockIndexes(db: Db) {
  const collection = db.collection<LockDocument>(LOCK_COLLECTION);
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

function toLockInfo(doc: LockDocument): JobLockInfo {
  return {
    targetDatabase: doc._id,
    jobId: doc.jobId,
    owner: doc.owner,
    startedAt: doc.startedAt.toISOString(),
    heartbeatAt: doc.heartbeatAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}

export async function getTargetLock(
  client: MongoClient,
  database: string,
): Promise<JobLockInfo | null> {
  const db = client.db(database);
  const doc = await db.collection<LockDocument>(LOCK_COLLECTION).findOne({ _id: database });
  if (!doc) {
    return null;
  }

  if (doc.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return toLockInfo(doc);
}

export type AcquiredLock = {
  info: JobLockInfo;
  stopHeartbeat: () => void;
  release: () => Promise<void>;
};

export async function acquireJobLock(input: {
  client: MongoClient;
  connectionId: string;
  database: string;
  jobId: string;
}): Promise<AcquiredLock> {
  const key = inProcessKey(input.connectionId, input.database);
  const existingInProcess = inProcessLocks.get(key);
  if (existingInProcess && existingInProcess !== input.jobId) {
    throw new AppError(
      `Target database is already locked in this app by job ${existingInProcess}.`,
      409,
    );
  }

  const db = input.client.db(input.database);
  await ensureLockIndexes(db);
  const collection = db.collection<LockDocument>(LOCK_COLLECTION);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  const existing = await collection.findOne({ _id: input.database });
  if (existing && existing.expiresAt.getTime() > Date.now() && existing.jobId !== input.jobId) {
    const ageMs = Date.now() - existing.startedAt.getTime();
    throw new AppError(
      `Target database is locked by job ${existing.jobId} (owner ${existing.owner}, age ${Math.round(ageMs / 1000)}s).`,
      409,
    );
  }

  const doc: LockDocument = {
    _id: input.database,
    jobId: input.jobId,
    owner: processOwnerId,
    startedAt: existing?.jobId === input.jobId ? existing.startedAt : now,
    heartbeatAt: now,
    expiresAt,
  };

  await collection.findOneAndUpdate(
    {
      _id: input.database,
      $or: [
        { expiresAt: { $lte: now } },
        { jobId: input.jobId },
        { expiresAt: { $exists: false } },
      ],
    },
    { $set: doc },
    { upsert: true, returnDocument: "after" },
  );

  const confirmed = await collection.findOne({ _id: input.database });
  if (!confirmed || confirmed.jobId !== input.jobId) {
    throw new AppError(
      confirmed
        ? `Target database is locked by job ${confirmed.jobId} (owner ${confirmed.owner}).`
        : "Failed to acquire target database lock.",
      409,
    );
  }

  inProcessLocks.set(key, input.jobId);

  const timer = setInterval(() => {
    void heartbeatLock(input.client, input.database, input.jobId).catch(() => undefined);
  }, LOCK_HEARTBEAT_MS);
  timer.unref?.();

  return {
    info: toLockInfo(confirmed),
    stopHeartbeat: () => clearInterval(timer),
    release: async () => {
      clearInterval(timer);
      await releaseJobLock({
        client: input.client,
        connectionId: input.connectionId,
        database: input.database,
        jobId: input.jobId,
      });
    },
  };
}

async function heartbeatLock(client: MongoClient, database: string, jobId: string) {
  const now = new Date();
  await client
    .db(database)
    .collection<LockDocument>(LOCK_COLLECTION)
    .updateOne(
      { _id: database, jobId },
      {
        $set: {
          heartbeatAt: now,
          expiresAt: new Date(now.getTime() + LOCK_TTL_MS),
        },
      },
    );
}

export async function releaseJobLock(input: {
  client: MongoClient;
  connectionId: string;
  database: string;
  jobId: string;
}) {
  const key = inProcessKey(input.connectionId, input.database);
  if (inProcessLocks.get(key) === input.jobId) {
    inProcessLocks.delete(key);
  }

  await input.client
    .db(input.database)
    .collection<LockDocument>(LOCK_COLLECTION)
    .deleteOne({ _id: input.database, jobId: input.jobId });
}

export async function forceUnlockTarget(input: {
  client: MongoClient;
  connectionId: string;
  database: string;
}) {
  const key = inProcessKey(input.connectionId, input.database);
  inProcessLocks.delete(key);

  await input.client
    .db(input.database)
    .collection<LockDocument>(LOCK_COLLECTION)
    .deleteOne({ _id: input.database });
}

export function resetInProcessLocksForTests() {
  inProcessLocks.clear();
}
