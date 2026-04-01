import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import type { EncryptedSecret } from "@/src/types/models";

const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

function deriveKey(password: string, salt: Buffer) {
  return scryptSync(password, salt, KEY_LENGTH);
}

function encryptValue(value: string, password: string): EncryptedSecret {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const cipherText = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptValue(secret: EncryptedSecret, password: string) {
  const salt = Buffer.from(secret.salt, "base64");
  const iv = Buffer.from(secret.iv, "base64");
  const authTag = Buffer.from(secret.authTag, "base64");
  const cipherText = Buffer.from(secret.cipherText, "base64");
  const key = deriveKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSecret(value: string, password: string): EncryptedSecret {
  return encryptValue(value, password);
}

export function decryptSecret(secret: EncryptedSecret, password: string) {
  return decryptValue(secret, password);
}

export function encryptText(value: string, password: string): string {
  return JSON.stringify(encryptValue(value, password));
}

export function decryptText(value: string, password: string) {
  return decryptValue(JSON.parse(value) as EncryptedSecret, password);
}
