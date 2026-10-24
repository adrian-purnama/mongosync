import type { Db } from "mongodb";

import type { CollectionCheckpoint, SwapStep } from "@/src/types/models";
import { JOURNAL_PREFIX } from "@/src/server/mongo/copy-config";

export function journalCollectionName(jobId: string) {
  return `${JOURNAL_PREFIX}${jobId}`;
}

export async function collectionExists(db: Db, name: string) {
  const listed = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return listed.length > 0;
}

export async function dropCollectionIfExists(db: Db, name: string) {
  if (await collectionExists(db, name)) {
    await db.collection(name).drop();
  }
}

export async function renameCollection(
  db: Db,
  from: string,
  to: string,
  options?: { dropTarget?: boolean },
) {
  if (!(await collectionExists(db, from))) {
    throw new Error(`Cannot rename missing collection ${from}.`);
  }

  if (options?.dropTarget) {
    await dropCollectionIfExists(db, to);
  }

  await db.collection(from).rename(to, { dropTarget: Boolean(options?.dropTarget) });
}

export function buildReplaceSwapSteps(
  checkpoints: CollectionCheckpoint[],
): SwapStep[] {
  const steps: SwapStep[] = [];

  for (const checkpoint of checkpoints) {
    const backup = checkpoint.backupCollection;
    if (!backup) {
      continue;
    }

    steps.push({
      kind: "rename_live_to_backup",
      collection: checkpoint.targetCollection,
      from: checkpoint.targetCollection,
      to: backup,
      completedAt: null,
    });
    steps.push({
      kind: "rename_staging_to_live",
      collection: checkpoint.targetCollection,
      from: checkpoint.stagingCollection,
      to: checkpoint.targetCollection,
      completedAt: null,
    });
  }

  return steps;
}

export function buildNewCollectionSwapSteps(
  checkpoints: CollectionCheckpoint[],
): SwapStep[] {
  return checkpoints.map((checkpoint) => ({
    kind: "rename_staging_to_live" as const,
    collection: checkpoint.targetCollection,
    from: checkpoint.stagingCollection,
    to: checkpoint.targetCollection,
    completedAt: null,
  }));
}

export function buildRevertSwapSteps(
  checkpoints: CollectionCheckpoint[],
): SwapStep[] {
  const steps: SwapStep[] = [];

  for (const checkpoint of checkpoints) {
    const backup = checkpoint.backupCollection;
    if (!backup) {
      continue;
    }

    steps.push({
      kind: "drop_live",
      collection: checkpoint.targetCollection,
      from: checkpoint.targetCollection,
      to: checkpoint.targetCollection,
      completedAt: null,
    });
    steps.push({
      kind: "rename_backup_to_live",
      collection: checkpoint.targetCollection,
      from: backup,
      to: checkpoint.targetCollection,
      completedAt: null,
    });
  }

  return steps;
}

export async function executeSwapSteps(
  db: Db,
  steps: SwapStep[],
  onStepComplete: (step: SwapStep, index: number) => Promise<void>,
) {
  for (const [index, step] of steps.entries()) {
    if (step.completedAt) {
      continue;
    }

    switch (step.kind) {
      case "rename_live_to_backup": {
        if (await collectionExists(db, step.from)) {
          await renameCollection(db, step.from, step.to, { dropTarget: true });
        }
        break;
      }
      case "rename_staging_to_live": {
        await renameCollection(db, step.from, step.to, { dropTarget: true });
        break;
      }
      case "drop_live": {
        await dropCollectionIfExists(db, step.from);
        break;
      }
      case "rename_backup_to_live": {
        await renameCollection(db, step.from, step.to, { dropTarget: true });
        break;
      }
      case "drop_staging":
      case "drop_backup": {
        await dropCollectionIfExists(db, step.from);
        break;
      }
      default:
        break;
    }

    const completed: SwapStep = {
      ...step,
      completedAt: new Date().toISOString(),
    };
    await onStepComplete(completed, index);
  }
}

export async function dropStagingCollections(
  db: Db,
  checkpoints: CollectionCheckpoint[],
) {
  for (const checkpoint of checkpoints) {
    if (checkpoint.stagingCollection !== checkpoint.targetCollection) {
      await dropCollectionIfExists(db, checkpoint.stagingCollection);
    }
  }
}

export async function estimateBackupBytes(
  db: Db,
  checkpoints: CollectionCheckpoint[],
) {
  let total = 0;

  for (const checkpoint of checkpoints) {
    const backup = checkpoint.backupCollection;
    if (!backup || !(await collectionExists(db, backup))) {
      continue;
    }

    const stats = (await db.command({ collStats: backup })) as { size?: number };
    total += stats.size ?? 0;
  }

  return total;
}
