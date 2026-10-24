/** Tunables for copy / export / lock / backup behavior. */

export const BATCH_DOCS = 2000;
/** Approximate byte budget per batch (BSON.calculateObjectSize). */
export const BATCH_BYTES = 8 * 1024 * 1024;
export const MAX_INFLIGHT_WRITES = 3;
export const COLLECTION_CONCURRENCY = 3;

export const RETRY_BASE_MS = 1000;
export const RETRY_MAX_MS = 16_000;
export const RETRY_MAX_ATTEMPTS = 5;

/** How often encrypted job snapshots are flushed while a job runs. */
export const JOB_PERSIST_INTERVAL_MS = 3000;

export const LOCK_HEARTBEAT_MS = 10_000;
/** Lock expires this long after the last heartbeat. */
export const LOCK_TTL_MS = 60_000;
export const LOCK_COLLECTION = "_mongosync_locks";

export const BACKUP_KEEP_JOBS = 3;
export const BACKUP_KEEP_DAYS = 10;

export const VERIFY_SAMPLE_SIZE = 200;

export const MONGO_MAX_POOL_SIZE = 20;
export const MONGO_SERVER_SELECTION_TIMEOUT_MS = 5000;
export const MONGO_SOCKET_TIMEOUT_MS = 120_000;

export const EXPORT_ZLIB_LEVEL = 6;

export const STAGING_SUFFIX_PREFIX = "__mongosync_staging_";
export const BACKUP_SUFFIX_PREFIX = "__mongosync_backup_";
export const JOURNAL_PREFIX = "_mongosync_journal_";
