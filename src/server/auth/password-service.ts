import bcrypt from "bcryptjs";

import { AppError } from "@/src/server/utils/errors";

const PASSWORD_MIN_LENGTH = 8;
const RECOVERY_ANSWER_MIN_LENGTH = 3;
const BCRYPT_COST = 12;

export function validateMasterPassword(password: string) {
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Master password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    );
  }
}

export async function hashMasterPassword(password: string) {
  validateMasterPassword(password);
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyMasterPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function normalizeRecoveryAnswer(answer: string) {
  return answer.toLowerCase().replace(/\s+/g, "");
}

export function validateRecoveryAnswer(answer: string) {
  const normalized = normalizeRecoveryAnswer(answer);

  if (normalized.length < RECOVERY_ANSWER_MIN_LENGTH) {
    throw new AppError(
      `Recovery answer must be at least ${RECOVERY_ANSWER_MIN_LENGTH} characters after normalizing.`,
      400,
    );
  }

  return normalized;
}

export function validateRecoveryQuestion(question: string) {
  const trimmed = question.trim();

  if (trimmed.length < 3) {
    throw new AppError("Recovery question must be at least 3 characters long.", 400);
  }

  return trimmed;
}

export async function hashRecoveryAnswer(answer: string) {
  const normalized = validateRecoveryAnswer(answer);
  return bcrypt.hash(normalized, BCRYPT_COST);
}

export async function verifyRecoveryAnswer(answer: string, hash: string) {
  const normalized = normalizeRecoveryAnswer(answer);
  return bcrypt.compare(normalized, hash);
}
