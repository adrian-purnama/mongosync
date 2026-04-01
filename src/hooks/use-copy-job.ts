"use client";

import { useEffect, useState } from "react";

import { POLL_INTERVAL_MS } from "@/src/server/config/constants";
import type { CopyJob } from "@/src/types/models";
import { readApiResponse } from "@/src/utils/api-client";

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
        const payload = await readApiResponse<CopyJob>(response, "Failed to load job.");

        if (!cancelled) {
          setJob(payload);
          setError(null);
        }

        if (
          !cancelled &&
          (payload as CopyJob).status !== "completed" &&
          (payload as CopyJob).status !== "failed" &&
          (payload as CopyJob).status !== "interrupted"
        ) {
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
