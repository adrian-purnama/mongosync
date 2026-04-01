import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  APP_DATA_DIR_NAME,
  APP_DATA_FILE_NAME,
} from "@/src/server/config/constants";

function getBaseAppDataDirectory() {
  if (process.env.MONGOSYNC_DATA_DIR) {
    return process.env.MONGOSYNC_DATA_DIR;
  }

  if (process.env.NODE_ENV === "test") {
    return path.join(process.cwd(), ".tmp", "mongosync-local");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, APP_DATA_DIR_NAME);
  }

  return path.join(os.homedir(), `.${APP_DATA_DIR_NAME.toLowerCase()}`);
}

export function getAppDataFilePath() {
  return path.join(getBaseAppDataDirectory(), APP_DATA_FILE_NAME);
}

export function getAppDataDirectoryPath() {
  return getBaseAppDataDirectory();
}

export async function ensureAppDataDirectory() {
  await mkdir(path.dirname(getAppDataFilePath()), { recursive: true });
}

export async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

export async function readTextFile(filePath: string) {
  return readFile(filePath, "utf8");
}

export async function writeTextFile(filePath: string, value: string) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function appendTextFile(filePath: string, value: string) {
  await ensureDirectory(path.dirname(filePath));
  await appendFile(filePath, value, "utf8");
}

export async function writeTextFileAtomically(filePath: string, value: string) {
  await ensureDirectory(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tempPath, value, "utf8");
  await rename(tempPath, filePath);
}

export async function listDirectory(directoryPath: string) {
  await ensureDirectory(directoryPath);
  return readdir(directoryPath, { withFileTypes: true });
}

export async function deletePath(filePath: string) {
  await rm(filePath, { recursive: true, force: true });
}
