import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { serialize } from "cookie";

import {
  APP_DATA_DIR_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/src/server/config/constants";
import { ensureAppDataDirectory, getAppDataFilePath, readTextFile, writeTextFile } from "@/src/server/storage/file-system";

const SESSION_SECRET_FILE = "session-secret.key";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

let cachedSessionSecret: string | null = null;

type CookieSessionPayload = {
  password: string;
  exp: number;
};

function getSessionSecretFilePath() {
  return path.join(path.dirname(getAppDataFilePath()), SESSION_SECRET_FILE);
}

async function getSessionSecret() {
  if (cachedSessionSecret) {
    return cachedSessionSecret;
  }

  const secretPath = getSessionSecretFilePath();

  try {
    await access(secretPath, fsConstants.F_OK);
    cachedSessionSecret = await readTextFile(secretPath);
    return cachedSessionSecret.trim();
  } catch {
    await ensureAppDataDirectory();
    const secret = randomBytes(48).toString("hex");
    await writeTextFile(secretPath, secret);
    cachedSessionSecret = secret;
    return secret;
  }
}

function deriveKey(secret: string) {
  return scryptSync(secret, APP_DATA_DIR_NAME, KEY_LENGTH);
}

export async function createSession(password: string) {
  const secret = await getSessionSecret();
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const payload: CookieSessionPayload = {
    password,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64url");
}

export async function getSession(sessionToken: string | undefined) {
  if (!sessionToken) {
    return null;
  }

  try {
    const secret = await getSessionSecret();
    const key = deriveKey(secret);
    const token = Buffer.from(sessionToken, "base64url");
    const iv = token.subarray(0, IV_LENGTH);
    const authTag = token.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = token.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(decrypted) as CookieSessionPayload;

    if (payload.exp <= Date.now()) {
      return null;
    }

    return {
      id: "cookie-session",
      password: payload.password,
      createdAt: payload.exp - SESSION_TTL_MS,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function deleteSession() {
  // Stateless encrypted cookie session; nothing is stored server-side.
}

export function buildSessionCookie(sessionToken: string) {
  return serialize(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export function buildExpiredSessionCookie() {
  return serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}
