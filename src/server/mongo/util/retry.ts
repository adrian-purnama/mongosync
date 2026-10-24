import {
  RETRY_BASE_MS,
  RETRY_MAX_ATTEMPTS,
  RETRY_MAX_MS,
} from "@/src/server/mongo/copy-config";

export function isRetryableMongoError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as {
    name?: string;
    code?: number | string;
    codeName?: string;
    errorLabels?: string[];
    message?: string;
  };

  const labels = err.errorLabels ?? [];
  if (
    labels.includes("RetryableWriteError") ||
    labels.includes("TransientTransactionError") ||
    labels.includes("RetryableReadError")
  ) {
    return true;
  }

  if (
    err.name === "MongoNetworkError" ||
    err.name === "MongoNetworkTimeoutError" ||
    err.name === "MongoServerSelectionError"
  ) {
    return true;
  }

  if (
    err.codeName === "NotWritablePrimary" ||
    err.codeName === "ExceededTimeLimit" ||
    err.codeName === "HostUnreachable" ||
    err.codeName === "HostNotFound" ||
    err.codeName === "NetworkTimeout" ||
    err.codeName === "ShutdownInProgress" ||
    err.codeName === "PrimarySteppedDown" ||
    err.codeName === "InterruptedAtShutdown" ||
    err.codeName === "InterruptedDueToReplStateChange"
  ) {
    return true;
  }

  const message = err.message?.toLowerCase() ?? "";
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket") ||
    message.includes("timed out") ||
    message.includes("not primary")
  ) {
    return true;
  }

  return false;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as { code?: number; writeErrors?: Array<{ code?: number }> };
  if (err.code === 11000) {
    return true;
  }

  return Boolean(err.writeErrors?.some((entry) => entry.code === 11000));
}

function delayMs(attempt: number) {
  const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number, waitMs: number) => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? RETRY_MAX_ATTEMPTS;
  const shouldRetry = options?.shouldRetry ?? isRetryableMongoError;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? new Error("Aborted.");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      const waitMs = delayMs(attempt);
      await options?.onRetry?.(error, attempt, waitMs);
      await sleep(waitMs, options?.signal);
    }
  }

  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted."));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted."));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
