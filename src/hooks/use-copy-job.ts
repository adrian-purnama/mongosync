"use client";

import { useEffect, useState } from "react";

import { POLL_INTERVAL_MS } from "@/src/server/config/constants";
import type { CopyJob, CopyJobStatus } from "@/src/types/models";

const TERMINAL_STATUSES = new Set<CopyJobStatus>([
  "completed",
  "failed",
  "cancelled",
  "reverted",
  "interrupted",
]);

/** Keep polling while paused so resume from another tab still updates UI after restart. */
const ACTIVE_POLL_STATUSES = new Set<CopyJobStatus>([
  "queued",
  "running",
  "paused",
  "verifying",
  "swapping",
]);

export function useCopyJob(jobId: string | null) {
  const [job, setJob] = useState<CopyJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/copy/jobs/${jobId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as CopyJob | { error: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? (payload.error ?? "Failed to load job.") : "Failed to load job.",
          );
        }

        const nextJob = payload as CopyJob;

        if (!cancelled) {
          setJob(nextJob);
          setError(null);
        }

        if (!cancelled && ACTIVE_POLL_STATUSES.has(nextJob.status)) {
          window.setTimeout(poll, POLL_INTERVAL_MS);
        } else if (!cancelled && !TERMINAL_STATUSES.has(nextJob.status)) {
          window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(
            pollError instanceof Error ? pollError.message : "Failed to poll job.",
          );
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { job, error };
}
