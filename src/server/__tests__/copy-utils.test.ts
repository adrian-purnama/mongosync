import { describe, expect, it } from "vitest";

import {
  createBatchAccumulator,
  pushToBatch,
  shouldFlushBatch,
  takeBatch,
} from "@/src/server/mongo/copy/batching";
import { BATCH_DOCS } from "@/src/server/mongo/copy-config";
import { createLimit } from "@/src/server/mongo/util/limit";
import {
  isDuplicateKeyError,
  isRetryableMongoError,
  withRetry,
} from "@/src/server/mongo/util/retry";

describe("copy batching", () => {
  it("flushes when doc count reaches BATCH_DOCS", () => {
    const batch = createBatchAccumulator();
    for (let index = 0; index < BATCH_DOCS; index += 1) {
      pushToBatch(batch, { _id: index, value: "x" });
    }
    expect(shouldFlushBatch(batch)).toBe(true);
    const taken = takeBatch(batch);
    expect(taken.docs).toHaveLength(BATCH_DOCS);
    expect(batch.docs).toHaveLength(0);
  });
});

describe("concurrency limit", () => {
  it("never exceeds concurrency", async () => {
    const limit = createLimit(2);
    let active = 0;
    let maxActive = 0;

    await Promise.all(
      Array.from({ length: 8 }, () =>
        limit(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 20));
          active -= 1;
        }),
      ),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("retry helpers", () => {
  it("detects duplicate key and retryable network errors", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isRetryableMongoError({ name: "MongoNetworkError" })).toBe(true);
    expect(isRetryableMongoError({ codeName: "NotWritablePrimary" })).toBe(true);
    expect(isRetryableMongoError({ message: "plain failure" })).toBe(false);
  });

  it("retries then succeeds", async () => {
    let attempts = 0;
    const value = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("reset");
          error.name = "MongoNetworkError";
          throw error;
        }
        return "ok";
      },
      { maxAttempts: 5 },
    );

    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });
});
