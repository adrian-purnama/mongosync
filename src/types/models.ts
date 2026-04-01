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

export type Connection = {
  id: string;
  name: string;
  encryptedMongoUrl: EncryptedSecret;
  mongoUrlPreview?: string;
  locked: boolean;
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
export type JobKind = "copy" | "export";

export type CopyJobStatus =
  | "queued"
  | "running"
  | "cancelled"
  | "completed"
  | "failed"
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
  | "unknown";

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
  totalDocuments: number | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  cancelRequestedAt?: string | null;
  lastPersistedAt: string | null;
  retentionExpiresAt: string | null;
  interruptedReason: CopyJobInterruptionReason | null;
  artifactFileName?: string | null;
  artifactStoredAt?: string | null;
  artifactContentType?: string | null;
  resultAvailable?: boolean;
  logs: CopyJobLog[];
};
