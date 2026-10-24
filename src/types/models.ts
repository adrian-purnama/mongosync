export type AppSchemaVersion = 1;

export type UserRecord = {
  masterPasswordHash: string;
  createdAt: string;
};

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
};

export type EncryptedSecret = {
  cipherText: string;
  iv: string;
  salt: string;
  authTag: string;
};

export type ConnectionEnvironment = "prod" | "staging" | "dev" | "local";

export type Connection = {
  id: string;
  name: string;
  encryptedMongoUrl: EncryptedSecret;
  mongoUrlPreview?: string;
  locked: boolean;
  environment: ConnectionEnvironment;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  version: AppSchemaVersion;
  user: UserRecord | null;
  organizations: Organization[];
  connections: Connection[];
};

export type SessionRecord = {
  id: string;
  password: string;
  createdAt: number;
  expiresAt: number;
};

export type CopyMode = "override" | "append" | "new";
export type JobKind = "copy" | "export" | "import";

export type CopyJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "verifying"
  | "swapping"
  | "cancelled"
  | "completed"
  | "failed"
  | "reverted"
  /** @deprecated Prefer paused for resumable jobs; kept for legacy snapshots. */
  | "interrupted";

export type CopyJobLogLevel = "info" | "warning" | "error";

export type CopyJobLog = {
  sequence: number;
  timestamp: string;
  level: CopyJobLogLevel;
  message: string;
};

export type CopyJobPersistenceSource = "memory" | "disk";

export type CopyJobInterruptionReason =
  | "process_restart"
  | "user_cancelled"
  | "retries_exhausted"
  | "unknown";

export type CollectionCheckpointStatus =
  | "pending"
  | "copying"
  | "copied"
  | "indexed"
  | "verified"
  | "swapped"
  | "failed";

export type CollectionCheckpoint = {
  sourceCollection: string;
  targetCollection: string;
  stagingCollection: string;
  backupCollection?: string | null;
  lastId: unknown | null;
  docsCopied: number;
  bytesCopied: number;
  status: CollectionCheckpointStatus;
  indexesCreated?: boolean;
};

export type SwapStepKind =
  | "rename_live_to_backup"
  | "rename_staging_to_live"
  | "drop_live"
  | "rename_backup_to_live"
  | "drop_staging"
  | "drop_backup";

export type SwapStep = {
  kind: SwapStepKind;
  collection: string;
  from: string;
  to: string;
  completedAt?: string | null;
};

export type JobLockInfo = {
  targetDatabase: string;
  jobId: string;
  owner: string;
  startedAt: string;
  heartbeatAt: string;
  expiresAt: string;
};

export type CopyJob = {
  id: string;
  kind: JobKind;
  status: CopyJobStatus;
  persistenceSource?: CopyJobPersistenceSource;
  mode?: CopyMode;
  organizationId: string;
  sourceConnectionId: string;
  targetConnectionId?: string | null;
  sourceDatabase: string;
  targetDatabase?: string | null;
  sourceCollection: string;
  targetCollection?: string | null;
  sourceCollections: string[];
  targetCollections?: string[] | null;
  processedDocuments: number;
  processedBytes?: number;
  totalDocuments: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  cancelRequestedAt?: string | null;
  lastPersistedAt: string | null;
  retentionExpiresAt: string | null;
  interruptedReason: CopyJobInterruptionReason | null;
  resumable?: boolean;
  checkpoints?: CollectionCheckpoint[];
  swapSteps?: SwapStep[];
  journalCollection?: string | null;
  lock?: JobLockInfo | null;
  backupBytesEstimate?: number | null;
  filter?: Record<string, unknown> | null;
  limit?: number | null;
  artifactFileName?: string | null;
  artifactStoredAt?: string | null;
  artifactContentType?: string | null;
  resultAvailable?: boolean;
  logs: CopyJobLog[];
};
