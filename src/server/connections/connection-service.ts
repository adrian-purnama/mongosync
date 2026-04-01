import { randomUUID } from "node:crypto";

import { decryptSecret, encryptSecret } from "@/src/server/security/encryption-service";
import { getAppData, updateAppData } from "@/src/server/storage/config-store";
import { AppError } from "@/src/server/utils/errors";
import type { Connection } from "@/src/types/models";

type CreateConnectionInput = {
  name: string;
  mongoUrl: string;
  locked: boolean;
  organizationId: string;
  password: string;
};

type UpdateConnectionInput = Partial<CreateConnectionInput> & {
  id: string;
};

function ensureOrganizationExists(
  organizationId: string,
  organizationIds: Set<string>,
) {
  if (!organizationIds.has(organizationId)) {
    throw new AppError("Selected organization was not found.", 404);
  }
}

export async function listConnections(
  organizationId: string | undefined,
  password: string,
) {
  const data = await getAppData();

  return data.connections
    .filter((connection) =>
      organizationId ? connection.organizationId === organizationId : true,
    )
    .map((connection) => withMongoUrlPreview(connection, password))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createConnection(input: CreateConnectionInput) {
  const mongoUrl = input.mongoUrl.trim();

  await assertConnectionIsReachable(mongoUrl);

  let createdConnection: Connection | null = null;

  await updateAppData((current) => {
    ensureOrganizationExists(
      input.organizationId,
      new Set(current.organizations.map((organization) => organization.id)),
    );

    const timestamp = new Date().toISOString();
    const connection: Connection = {
      id: randomUUID(),
      name: input.name.trim(),
      encryptedMongoUrl: encryptSecret(mongoUrl, input.password),
      locked: input.locked,
      organizationId: input.organizationId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    createdConnection = connection;

    return {
      ...current,
      connections: [...current.connections, connection],
    };
  });

  return createdConnection ? withMongoUrlPreview(createdConnection, input.password) : null;
}

export async function updateConnection(input: UpdateConnectionInput) {
  const nextMongoUrl = input.mongoUrl?.trim();

  if (nextMongoUrl) {
    await assertConnectionIsReachable(nextMongoUrl);
  }

  let updatedConnection: Connection | null = null;

  await updateAppData((current) => {
    const organizationIds = new Set(
      current.organizations.map((organization) => organization.id),
    );

    const nextConnections = current.connections.map((connection) => {
      if (connection.id !== input.id) {
        return connection;
      }

      const organizationId = input.organizationId ?? connection.organizationId;
      ensureOrganizationExists(organizationId, organizationIds);

      updatedConnection = {
        ...connection,
        name: input.name?.trim() || connection.name,
        organizationId,
        locked: input.locked ?? connection.locked,
        encryptedMongoUrl: nextMongoUrl
          ? encryptSecret(nextMongoUrl, input.password!)
          : connection.encryptedMongoUrl,
        updatedAt: new Date().toISOString(),
      };

      return updatedConnection;
    });

    if (!updatedConnection) {
      throw new AppError("Connection not found.", 404);
    }

    return {
      ...current,
      connections: nextConnections,
    };
  });

  return updatedConnection ? withMongoUrlPreview(updatedConnection, input.password!) : null;
}

export async function deleteConnection(id: string) {
  await updateAppData((current) => {
    const connection = current.connections.find((item) => item.id === id);

    if (!connection) {
      throw new AppError("Connection not found.", 404);
    }

    if (connection.locked) {
      throw new AppError("Locked connections cannot be deleted.", 409);
    }

    return {
      ...current,
      connections: current.connections.filter((item) => item.id !== id),
    };
  });
}

export async function getConnectionById(id: string) {
  const data = await getAppData();
  return data.connections.find((connection) => connection.id === id) ?? null;
}

export function decryptConnectionUrl(connection: Connection, password: string) {
  return decryptSecret(connection.encryptedMongoUrl, password);
}

function withMongoUrlPreview(connection: Connection, password: string): Connection {
  return {
    ...connection,
    mongoUrlPreview: buildMongoUrlPreview(connection, password),
  };
}

function buildMongoUrlPreview(connection: Connection, password: string) {
  try {
    const mongoUrl = decryptSecret(connection.encryptedMongoUrl, password);
    return mongoUrl.replace(
      /^(mongodb(?:\+srv)?:\/\/)([^:@/]+)(?::[^@/]*)?@/i,
      "$1$2:****@",
    );
  } catch {
    // Fall back to generic preview text below.
  }

  return "Saved MongoDB URL available. Click Show to verify.";
}

async function assertConnectionIsReachable(mongoUrl: string) {
  try {
    const { verifyMongoConnection } = await import(
      "@/src/server/mongo/mongo-client-factory"
    );
    await verifyMongoConnection(mongoUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "";
    const isSrvLookupFailure =
      mongoUrl.startsWith("mongodb+srv://") &&
      (errorMessage.includes("querySrv") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ETIMEOUT"));

    if (isSrvLookupFailure) {
      throw new AppError(
        "Unable to resolve the MongoDB Atlas SRV record from Node.js. This usually means a local DNS issue with `mongodb+srv://`. Try the standard non-SRV connection string from Compass or Atlas instead, such as `mongodb://host1,host2,host3/...`.",
        400,
      );
    }

    throw new AppError(
      error instanceof Error
        ? `Unable to connect to MongoDB with that URL: ${error.message}`
        : "Unable to connect to MongoDB with that URL.",
      400,
    );
  }
}
