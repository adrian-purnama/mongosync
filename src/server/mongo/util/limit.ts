/**
 * Simple concurrency limiter (p-limit style).
 */
export function createLimit(concurrency: number) {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1.");
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) {
      return;
    }

    const run = queue.shift();
    if (!run) {
      return;
    }

    active += 1;
    run();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
  };
}
