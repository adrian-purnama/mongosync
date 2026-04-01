import path from "node:path";

import {
  APP_DATA_FILE_NAME,
  JOBS_DIR_NAME,
  SESSION_SECRET_FILE_NAME,
} from "@/src/server/config/constants";
import { decryptSecret, encryptSecret } from "@/src/server/security/encryption-service";
import { getAppData, saveAppData } from "@/src/server/storage/config-store";
import { deletePath, getAppDataDirectoryPath } from "@/src/server/storage/file-system";
import { AppError } from "@/src/server/utils/errors";
import { hashMasterPassword, verifyMasterPassword } from "./password-service";

export async function changeMasterPassword(
  currentPassword: string,
  nextPassword: string,
) {
  const data = await getAppData();

  if (!data.user) {
    throw new AppError("Master password is not configured.", 404);
  }

  const valid = await verifyMasterPassword(
    currentPassword,
    data.user.masterPasswordHash,
  );

  if (!valid) {
    throw new AppError("Current password is incorrect.", 401);
  }

  const reencryptedConnections = data.connections.map((connection) => {
    const mongoUrl = decryptSecret(connection.encryptedMongoUrl, currentPassword);

    return {
      ...connection,
      encryptedMongoUrl: encryptSecret(mongoUrl, nextPassword),
      updatedAt: new Date().toISOString(),
    };
  });

  await saveAppData({
    ...data,
    user: {
      masterPasswordHash: await hashMasterPassword(nextPassword),
      createdAt: data.user.createdAt,
    },
    connections: reencryptedConnections,
  });
}

export async function resetAllLocalData() {
  const appDataDirectory = getAppDataDirectoryPath();

  await Promise.all([
    deletePath(path.join(appDataDirectory, APP_DATA_FILE_NAME)),
    deletePath(path.join(appDataDirectory, JOBS_DIR_NAME)),
    deletePath(path.join(appDataDirectory, SESSION_SECRET_FILE_NAME)),
  ]);

  await saveAppData({
    version: 1,
    user: null,
    organizations: [],
    connections: [],
  });
}
