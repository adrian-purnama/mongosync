import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

import {
  APP_DATA_DIR_NAME,
  JOB_ENCRYPTION_KEY_FILE_NAME,
  JOBS_DIR_NAME,
} from "@/src/server/config/constants";
import {
  appendTextFile,
  ensureDirectory,
  getAppDataFilePath,
  listDirectory,
  readTextFile,
  writeTextFile,
  writeTextFileAtomically,
} from "@/src/server/storage/file-system";

function getJobsDirectoryPath() {
  return path.join(path.dirname(getAppDataFilePath()), JOBS_DIR_NAME);
}

function getJobArtifactsDirectoryPath() {
  return path.join(getJobsDirectoryPath(), "artifacts");
}

export function getJobSnapshotPath(jobId: string) {
  return path.join(getJobsDirectoryPath(), `${jobId}.snapshot.enc`);
}

export function getJobLogsPath(jobId: string) {
  return path.join(getJobsDirectoryPath(), `${jobId}.logs.enc`);
}

export function getJobsSecretKeyPath() {
  return path.join(getJobsDirectoryPath(), JOB_ENCRYPTION_KEY_FILE_NAME);
}

export function getJobArtifactPath(jobId: string) {
  return path.join(getJobArtifactsDirectoryPath(), `${jobId}.artifact.bin`);
}

export async function ensureJobsDirectory() {
  await ensureDirectory(getJobsDirectoryPath());
}

export async function ensureJobArtifactsDirectory() {
  await ensureDirectory(getJobArtifactsDirectoryPath());
}

export async function writeJobSnapshot(jobId: string, value: string) {
  await ensureJobsDirectory();
  await writeTextFileAtomically(getJobSnapshotPath(jobId), value);
}

export async function readJobSnapshot(jobId: string) {
  return readTextFile(getJobSnapshotPath(jobId));
}

export async function appendJobLogLine(jobId: string, value: string) {
  await ensureJobsDirectory();
  await appendTextFile(getJobLogsPath(jobId), `${value}\n`);
}

export async function readJobLogLines(jobId: string) {
  try {
    const raw = await readTextFile(getJobLogsPath(jobId));
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function listPersistedJobIds() {
  await ensureJobsDirectory();
  const entries = await listDirectory(getJobsDirectoryPath());

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".snapshot.enc"))
    .map((entry) => entry.name.replace(/\.snapshot\.enc$/, ""));
}

export async function getOrCreateJobsSecretKey() {
  await ensureJobsDirectory();
  const secretPath = getJobsSecretKeyPath();

  try {
    await access(secretPath, fsConstants.F_OK);
    return (await readTextFile(secretPath)).trim();
  } catch {
    const secret = `${APP_DATA_DIR_NAME}-${randomUUID()}-${Date.now()}`;
    await writeTextFile(secretPath, secret);
    return secret;
  }
}

export async function writeJobArtifact(jobId: string, value: Uint8Array) {
  await ensureJobArtifactsDirectory();
  await writeTextFileAtomically(
    getJobArtifactPath(jobId),
    Buffer.from(value).toString("base64"),
  );
}

export async function readJobArtifact(jobId: string) {
  const raw = await readTextFile(getJobArtifactPath(jobId));
  return Buffer.from(raw, "base64");
}
