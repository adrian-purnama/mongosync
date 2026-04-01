import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import type { AppData } from "@/src/types/models";
import { getAppDataFilePath, readTextFile, writeTextFile } from "./file-system";

const DEFAULT_APP_DATA: AppData = {
  version: 1,
  user: null,
  organizations: [],
  connections: [],
};

export async function getAppData() {
  const filePath = getAppDataFilePath();

  try {
    await access(filePath, fsConstants.F_OK);
  } catch {
    await saveAppData(DEFAULT_APP_DATA);
    return structuredClone(DEFAULT_APP_DATA);
  }

  const raw = await readTextFile(filePath);
  const parsed = JSON.parse(raw) as Partial<AppData>;

  return {
    ...DEFAULT_APP_DATA,
    ...parsed,
    organizations: parsed.organizations ?? [],
    connections: parsed.connections ?? [],
    user: parsed.user ?? null,
  } satisfies AppData;
}

export async function saveAppData(data: AppData) {
  const filePath = getAppDataFilePath();
  await writeTextFile(filePath, JSON.stringify(data, null, 2));
}

export async function updateAppData(
  updater: (current: AppData) => AppData | Promise<AppData>,
) {
  const current = await getAppData();
  const next = await updater(current);
  await saveAppData(next);
  return next;
}

export async function hasConfiguredUser() {
  const data = await getAppData();
  return Boolean(data.user);
}
