import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  changeMasterPassword,
  clearRecovery,
  recoverMasterPassword,
  resetAllLocalData,
  setRecovery,
} from "@/src/server/auth/password-management-service";
import { hashMasterPassword } from "@/src/server/auth/password-service";
import { resetCopyJobRuntimeForTests, createCopyJob } from "@/src/server/mongo/copy-job-store";
import { decryptSecret, encryptSecret } from "@/src/server/security/encryption-service";
import { getAppData, saveAppData } from "@/src/server/storage/config-store";
import { listPersistedJobs } from "@/src/server/jobs/job-store";

describe("password management", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-password-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;
    resetCopyJobRuntimeForTests();

    await saveAppData({
      version: 1,
      user: {
        masterPasswordHash: await hashMasterPassword("old-password"),
        createdAt: new Date().toISOString(),
      },
      organizations: [
        {
          id: "org-1",
          name: "Org One",
          createdAt: new Date().toISOString(),
        },
      ],
      connections: [
        {
          id: "conn-1",
          name: "Connection One",
          encryptedMongoUrl: encryptSecret(
            "mongodb://localhost:27017/source",
            "old-password",
          ),
          locked: false,
          environment: "local",
          organizationId: "org-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(async () => {
    delete process.env.MONGOSYNC_DATA_DIR;
    resetCopyJobRuntimeForTests();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("changes password and re-encrypts connections", async () => {
    await changeMasterPassword("old-password", "new-password");
    const data = await getAppData();
    const connection = data.connections[0];

    expect(connection).toBeDefined();
    expect(
      decryptSecret(connection!.encryptedMongoUrl, "new-password"),
    ).toBe("mongodb://localhost:27017/source");
    expect(() =>
      decryptSecret(connection!.encryptedMongoUrl, "old-password"),
    ).toThrow();
  });

  it("rejects invalid current password", async () => {
    await expect(
      changeMasterPassword("wrong-password", "new-password"),
    ).rejects.toThrow("Current password is incorrect.");
  });

  it("resets all local data and clears persisted jobs", async () => {
    await createCopyJob({
      id: "job-1",
      mode: "append",
      organizationId: "org-1",
      sourceConnectionId: "conn-1",
      targetConnectionId: "conn-1b",
      sourceDatabase: "db-a",
      targetDatabase: "db-b",
      sourceCollection: "users",
      targetCollection: "users",
      sourceCollections: ["users"],
      targetCollections: ["users"],
    });

    await resetAllLocalData();

    const data = await getAppData();
    const jobs = await listPersistedJobs();

    expect(data.user).toBeNull();
    expect(data.organizations).toEqual([]);
    expect(data.connections).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it("recovers with normalized answer variants and keeps connections", async () => {
    await setRecovery("old-password", "What city?", "My Answer");

    await recoverMasterPassword(" MY  ANSWER ", "recovered-password");

    const data = await getAppData();
    const connection = data.connections[0];

    expect(data.organizations).toHaveLength(1);
    expect(data.connections).toHaveLength(1);
    expect(data.user?.recoveryQuestion).toBe("What city?");
    expect(
      decryptSecret(connection!.encryptedMongoUrl, "recovered-password"),
    ).toBe("mongodb://localhost:27017/source");
    expect(() =>
      decryptSecret(connection!.encryptedMongoUrl, "old-password"),
    ).toThrow();
  });

  it("accepts myanswer as equivalent to My Answer after normalization", async () => {
    await setRecovery("old-password", "What city?", "My Answer");
    await recoverMasterPassword("myanswer", "another-password");

    const data = await getAppData();
    expect(
      decryptSecret(data.connections[0]!.encryptedMongoUrl, "another-password"),
    ).toBe("mongodb://localhost:27017/source");
  });

  it("rejects incorrect recovery answer without changing data", async () => {
    await setRecovery("old-password", "What city?", "My Answer");

    await expect(
      recoverMasterPassword("wrong answer", "new-password"),
    ).rejects.toThrow("Incorrect recovery answer.");

    const data = await getAppData();
    expect(
      decryptSecret(data.connections[0]!.encryptedMongoUrl, "old-password"),
    ).toBe("mongodb://localhost:27017/source");
  });

  it("keeps recovery working after a password change", async () => {
    await setRecovery("old-password", "What city?", "My Answer");
    await changeMasterPassword("old-password", "rotated-password");

    await recoverMasterPassword("myanswer", "after-rotate");

    const data = await getAppData();
    expect(
      decryptSecret(data.connections[0]!.encryptedMongoUrl, "after-rotate"),
    ).toBe("mongodb://localhost:27017/source");
    expect(data.organizations).toHaveLength(1);
  });

  it("clears recovery so recover is no longer available", async () => {
    await setRecovery("old-password", "What city?", "My Answer");
    await clearRecovery("old-password");

    await expect(
      recoverMasterPassword("myanswer", "new-password"),
    ).rejects.toThrow("Recovery is not configured.");

    const data = await getAppData();
    expect(data.user?.recoveryQuestion).toBeUndefined();
    expect(data.user?.wrappedMasterPassword).toBeUndefined();
  });
});
