import bcrypt from "bcryptjs";

const PASSWORD_MIN_LENGTH = 8;

export function validateMasterPassword(password: string) {
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Master password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
    );
  }
}

export async function hashMasterPassword(password: string) {
  validateMasterPassword(password);
  return bcrypt.hash(password, 12);
}

export async function verifyMasterPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
