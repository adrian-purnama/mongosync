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
import type { UserRecord } from "@/src/types/models";
import {
  hashMasterPassword,
  hashRecoveryAnswer,
  normalizeRecoveryAnswer,
  validateMasterPassword,
  validateRecoveryAnswer,
  validateRecoveryQuestion,
  verifyMasterPassword,
  verifyRecoveryAnswer,
} from "./password-service";

function hasRecoveryConfigured(user: UserRecord) {
  return Boolean(
    user.recoveryQuestion &&
      user.recoveryAnswerHash &&
      user.wrappedMasterPassword &&
      user.wrappedRecoveryAnswer,
  );
}

function buildRecoveryFields(
  masterPassword: string,
  question: string,
  answer: string,
  answerHash: string,
) {
  const normalizedAnswer = validateRecoveryAnswer(answer);
  const recoveryQuestion = validateRecoveryQuestion(question);

  return {
    recoveryQuestion,
    recoveryAnswerHash: answerHash,
    wrappedMasterPassword: encryptSecret(masterPassword, normalizedAnswer),
    wrappedRecoveryAnswer: encryptSecret(normalizedAnswer, masterPassword),
  } satisfies Pick<
    UserRecord,
    | "recoveryQuestion"
    | "recoveryAnswerHash"
    | "wrappedMasterPassword"
    | "wrappedRecoveryAnswer"
  >;
}

function stripRecoveryFields(user: UserRecord): UserRecord {
  return {
    masterPasswordHash: user.masterPasswordHash,
    createdAt: user.createdAt,
  };
}

function reencryptConnections(
  connections: Awaited<ReturnType<typeof getAppData>>["connections"],
  currentPassword: string,
  nextPassword: string,
) {
  return connections.map((connection) => {
    const mongoUrl = decryptSecret(connection.encryptedMongoUrl, currentPassword);

    return {
      ...connection,
      encryptedMongoUrl: encryptSecret(mongoUrl, nextPassword),
      updatedAt: new Date().toISOString(),
    };
  });
}

function rewrapRecoveryForPasswordChange(
  user: UserRecord,
  currentPassword: string,
  nextPassword: string,
): Pick<
  UserRecord,
  | "recoveryQuestion"
  | "recoveryAnswerHash"
  | "wrappedMasterPassword"
  | "wrappedRecoveryAnswer"
> | null {
  if (!hasRecoveryConfigured(user) || !user.wrappedRecoveryAnswer) {
    return null;
  }

  try {
    const normalizedAnswer = decryptSecret(user.wrappedRecoveryAnswer, currentPassword);

    return {
      recoveryQuestion: user.recoveryQuestion,
      recoveryAnswerHash: user.recoveryAnswerHash,
      wrappedMasterPassword: encryptSecret(nextPassword, normalizedAnswer),
      wrappedRecoveryAnswer: encryptSecret(normalizedAnswer, nextPassword),
    };
  } catch {
    throw new AppError(
      "Recovery data could not be updated. Clear recovery and set it again.",
      500,
    );
  }
}

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

  validateMasterPassword(nextPassword);

  const recoveryFields = rewrapRecoveryForPasswordChange(
    data.user,
    currentPassword,
    nextPassword,
  );

  await saveAppData({
    ...data,
    user: {
      masterPasswordHash: await hashMasterPassword(nextPassword),
      createdAt: data.user.createdAt,
      ...(recoveryFields ?? {}),
    },
    connections: reencryptConnections(
      data.connections,
      currentPassword,
      nextPassword,
    ),
  });
}

export async function setRecovery(
  masterPassword: string,
  question: string,
  answer: string,
) {
  const data = await getAppData();

  if (!data.user) {
    throw new AppError("Master password is not configured.", 404);
  }

  const valid = await verifyMasterPassword(
    masterPassword,
    data.user.masterPasswordHash,
  );

  if (!valid) {
    throw new AppError("Master password is incorrect.", 401);
  }

  const answerHash = await hashRecoveryAnswer(answer);
  const recoveryFields = buildRecoveryFields(
    masterPassword,
    question,
    answer,
    answerHash,
  );

  await saveAppData({
    ...data,
    user: {
      ...data.user,
      ...recoveryFields,
    },
  });
}

export async function clearRecovery(masterPassword: string) {
  const data = await getAppData();

  if (!data.user) {
    throw new AppError("Master password is not configured.", 404);
  }

  const valid = await verifyMasterPassword(
    masterPassword,
    data.user.masterPasswordHash,
  );

  if (!valid) {
    throw new AppError("Master password is incorrect.", 401);
  }

  await saveAppData({
    ...data,
    user: stripRecoveryFields(data.user),
  });
}

export async function recoverMasterPassword(answer: string, nextPassword: string) {
  const data = await getAppData();

  if (!data.user || !hasRecoveryConfigured(data.user)) {
    throw new AppError("Recovery is not configured.", 404);
  }

  const {
    recoveryAnswerHash,
    wrappedMasterPassword,
    recoveryQuestion,
  } = data.user;

  if (!recoveryAnswerHash || !wrappedMasterPassword || !recoveryQuestion) {
    throw new AppError("Recovery is not configured.", 404);
  }

  const answerValid = await verifyRecoveryAnswer(answer, recoveryAnswerHash);

  if (!answerValid) {
    throw new AppError("Incorrect recovery answer.", 401);
  }

  validateMasterPassword(nextPassword);

  const normalizedAnswer = normalizeRecoveryAnswer(answer);
  let currentPassword: string;

  try {
    currentPassword = decryptSecret(wrappedMasterPassword, normalizedAnswer);
  } catch {
    throw new AppError("Incorrect recovery answer.", 401);
  }

  const answerHash = await hashRecoveryAnswer(normalizedAnswer);
  const recoveryFields = buildRecoveryFields(
    nextPassword,
    recoveryQuestion,
    normalizedAnswer,
    answerHash,
  );

  await saveAppData({
    ...data,
    user: {
      masterPasswordHash: await hashMasterPassword(nextPassword),
      createdAt: data.user.createdAt,
      ...recoveryFields,
    },
    connections: reencryptConnections(
      data.connections,
      currentPassword,
      nextPassword,
    ),
  });

  return nextPassword;
}

export function getRecoveryState(user: UserRecord | null) {
  if (!user || !hasRecoveryConfigured(user)) {
    return {
      hasRecovery: false as const,
      recoveryQuestion: null,
    };
  }

  return {
    hasRecovery: true as const,
    recoveryQuestion: user.recoveryQuestion ?? null,
  };
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
