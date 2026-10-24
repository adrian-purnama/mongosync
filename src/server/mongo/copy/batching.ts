import { BSON } from "bson";
import type { Document } from "mongodb";

import { BATCH_BYTES, BATCH_DOCS, MAX_INFLIGHT_WRITES } from "@/src/server/mongo/copy-config";

export type BatchAccumulator = {
  docs: Document[];
  bytes: number;
};

export function createBatchAccumulator(): BatchAccumulator {
  return { docs: [], bytes: 0 };
}

export function estimateDocumentBytes(document: Document): number {
  try {
    return BSON.calculateObjectSize(document);
  } catch {
    return JSON.stringify(document).length;
  }
}

export function shouldFlushBatch(batch: BatchAccumulator): boolean {
  return batch.docs.length >= BATCH_DOCS || batch.bytes >= BATCH_BYTES;
}

export function pushToBatch(batch: BatchAccumulator, document: Document): void {
  batch.docs.push(document);
  batch.bytes += estimateDocumentBytes(document);
}

export function takeBatch(batch: BatchAccumulator): { docs: Document[]; bytes: number } {
  const taken = { docs: batch.docs, bytes: batch.bytes };
  batch.docs = [];
  batch.bytes = 0;
  return taken;
}

/**
 * Tracks in-flight write promises and applies backpressure when the set is full.
 */
export class InflightWriteGate {
  private readonly inflight = new Set<Promise<void>>();

  constructor(private readonly maxInflight = MAX_INFLIGHT_WRITES) {}

  get size() {
    return this.inflight.size;
  }

  async enqueue(work: () => Promise<void>): Promise<void> {
    while (this.inflight.size >= this.maxInflight) {
      await Promise.race(this.inflight);
    }

    const promise = work().finally(() => {
      this.inflight.delete(promise);
    });
    this.inflight.add(promise);
  }

  async drain(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.allSettled([...this.inflight]);
    }
  }
}
