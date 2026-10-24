import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createConnection,
  deleteConnection,
} from "@/src/server/connections/connection-service";
import { startCopyJob } from "@/src/server/mongo/copy-service";
import { hashMasterPassword, verifyMasterPassword } from "@/src/server/auth/password-service";
import {
  decryptSecret,
  encryptSecret,
} from "@/src/server/security/encryption-service";
import { saveAppData } from "@/src/server/storage/config-store";

vi.mock("@/src/server/mongo/mongo-client-factory", () => ({
  createMongoClient: vi.fn(async () => ({
    close: async () => undefined,
    db: () => ({
      admin: () => ({
        command: async () => ({ ok: 1 }),
      }),
    }),
  })),
  verifyMongoConnection: vi.fn(async () => undefined),
}));

describe("security and copy rules", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mongosync-local-"));
    process.env.MONGOSYNC_DATA_DIR = tempDir;

    await saveAppData({
      version: 1,
      user: {
        masterPasswordHash: "hash",
        createdAt: new Date().toISOString(),
      },
      organizations: [
        {
          id: "org-1",
          name: "Org 1",
          createdAt: new Date().toISOString(),
        },
      ],
      connections: [],
    });
  });

  afterEach(async () => {
    delete process.env.MONGOSYNC_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("round-trips encrypted secrets with the master password", () => {
    const password = "super-secret-password";
    const secret = encryptSecret("mongodb://localhost:27017/source", password);

    expect(decryptSecret(secret, password)).toBe(
      "mongodb://localhost:27017/source",
    );
  });

  it("hashes and verifies the master password", async () => {
    const password = "another-secret";
    const hash = await hashMasterPassword(password);

    await expect(verifyMasterPassword(password, hash)).resolves.toBe(true);
    await expect(verifyMasterPassword("wrong-password", hash)).resolves.toBe(
      false,
    );
  });

  it("prevents deleting locked connections", async () => {
    const connection = await createConnection({
      name: "Locked target",
      mongoUrl: "mongodb://localhost:27017/locked",
      locked: true,
      environment: "prod",
      organizationId: "org-1",
      password: "master-password",
    });

    await expect(deleteConnection(connection!.id)).rejects.toThrow(
      "Locked connections cannot be deleted.",
    );
  });

  it("rejects override copy jobs when the target connection is locked", async () => {
    const source = await createConnection({
      name: "Source",
      mongoUrl: "mongodb://localhost:27017/source",
      locked: false,
      environment: "prod",
      organizationId: "org-1",
      password: "master-password",
    });
    const target = await createConnection({
      name: "Target",
      mongoUrl: "mongodb://localhost:27017/target",
      locked: true,
      environment: "dev",
      organizationId: "org-1",
      password: "master-password",
    });

    await expect(
      startCopyJob({
        organizationId: "org-1",
        sourceConnectionId: source!.id,
        targetConnectionId: target!.id,
        sourceDatabase: "source",
        targetDatabase: "target",
        sourceCollections: ["users"],
        mode: "override",
        password: "master-password",
      }),
    ).rejects.toThrow(
      "Locked target connections cannot be overwritten in override mode.",
    );
  });
});
