/** In-process AbortControllers for running jobs. */

const controllers = new Map<string, AbortController>();

export function getOrCreateJobAbortController(jobId: string) {
  const existing = controllers.get(jobId);
  if (existing) {
    return existing;
  }

  const controller = new AbortController();
  controllers.set(jobId, controller);
  return controller;
}

export function abortJob(jobId: string, reason?: unknown) {
  const controller = controllers.get(jobId);
  if (!controller) {
    const created = new AbortController();
    created.abort(reason);
    controllers.set(jobId, created);
    return;
  }

  if (!controller.signal.aborted) {
    controller.abort(reason);
  }
}

export function clearJobAbortController(jobId: string) {
  controllers.delete(jobId);
}

export function resetJobAbortControllersForTests() {
  controllers.clear();
}
