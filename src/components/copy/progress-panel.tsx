"use client";

import type { CopyJob } from "@/src/types/models";

type ProgressPanelProps = {
  job: CopyJob | null;
  error: string | null;
  onCancel?: (jobId: string) => Promise<void> | void;
  isCancelling?: boolean;
};

export function ProgressPanel({ job, error, onCancel, isCancelling = false }: ProgressPanelProps) {
  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </section>
    );
  }

  if (!job) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
        Start a copy or export job to see progress and logs here.
      </section>
    );
  }

  const progress =
    job.totalDocuments && job.totalDocuments > 0
      ? Math.min(100, Math.round((job.processedDocuments / job.totalDocuments) * 100))
      : 0;
  const latestLog = job.logs.at(-1) ?? null;
  const currentActivity = getCurrentActivity(job);
  const statusTone = getStatusTone(job.status);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">
            {job.kind === "export" ? "Export Progress" : "Copy Progress"}
          </h3>
          <p className="text-sm text-zinc-500">{getJobSummary(job)}</p>
          <p className="text-xs text-zinc-400">
            Source: {job.persistenceSource ?? "memory"}
            {job.lastPersistedAt ? ` | Saved ${new Date(job.lastPersistedAt).toLocaleString()}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone.badge}`}
        >
          {job.status}
        </span>
      </div>

      <div className={`mb-4 rounded-lg border px-4 py-3 ${statusTone.panel}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
              Current activity
            </p>
            <p className="mt-1 text-sm font-medium">{currentActivity}</p>
          </div>
          {latestLog ? (
            <p className="shrink-0 text-xs opacity-75">
              {new Date(latestLog.timestamp).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
        {job.status === "queued" ? (
          <p className="mt-2 text-xs opacity-75">
            The app has accepted your job and will start it as soon as the worker begins processing.
          </p>
        ) : null}
      </div>

      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mb-4 text-sm text-zinc-600">
        Processed {job.processedDocuments}
        {job.totalDocuments !== null ? ` of ${job.totalDocuments}` : ""} documents.
      </p>

      {job.error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {job.error}
        </p>
      ) : null}

      {job.interruptedReason ? (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This job was interrupted: {job.interruptedReason}.
        </p>
      ) : null}

      {job.cancelRequestedAt && job.status !== "cancelled" ? (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cancellation requested. The job will stop after the current safe step finishes.
        </p>
      ) : null}

      {onCancel && (job.status === "queued" || job.status === "running") ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              void onCancel(job.id);
            }}
            disabled={Boolean(job.cancelRequestedAt) || isCancelling}
            className="inline-flex rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {job.cancelRequestedAt || isCancelling ? "Cancelling..." : "Cancel job"}
          </button>
        </div>
      ) : null}

      {job.kind === "export" && job.resultAvailable && job.status === "completed" ? (
        <div className="mb-4">
          <a
            href={`/api/export/jobs/${job.id}/download`}
            className="inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Download {job.artifactFileName ?? "export"}
          </a>
        </div>
      ) : null}

      <div className="max-h-72 space-y-2 overflow-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-100">
        {job.logs.map((log) => (
          <div key={`${log.timestamp}-${log.message}`}>
            <span className="text-zinc-400">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>{" "}
            <span className="font-semibold uppercase">{log.level}</span>{" "}
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getJobSummary(job: CopyJob) {
  if (job.kind === "export") {
    return `${job.sourceDatabase}.${job.sourceCollection} to ${job.artifactFileName ?? "ZIP artifact"}`;
  }

  return `${job.sourceDatabase}.${job.sourceCollection} to ${job.targetDatabase}.${job.targetCollection}`;
}

function getCurrentActivity(job: CopyJob) {
  const latestLog = job.logs.at(-1);

  if (latestLog) {
    return latestLog.message;
  }

  switch (job.status) {
    case "queued":
      return "Waiting in the local queue to start.";
    case "running":
      return "Job is running.";
    case "completed":
      return job.kind === "export" ? "Export finished successfully." : "Copy finished successfully.";
    case "cancelled":
      return "Job cancelled.";
    case "failed":
      return job.error ?? "Job failed.";
    case "interrupted":
      return "Job was interrupted before completion.";
    default:
      return "Preparing job details.";
  }
}

function getStatusTone(status: CopyJob["status"]) {
  switch (status) {
    case "queued":
      return {
        badge: "bg-amber-100 text-amber-800",
        panel: "border-amber-200 bg-amber-50 text-amber-950",
      };
    case "running":
      return {
        badge: "bg-sky-100 text-sky-800",
        panel: "border-sky-200 bg-sky-50 text-sky-950",
      };
    case "completed":
      return {
        badge: "bg-emerald-100 text-emerald-800",
        panel: "border-emerald-200 bg-emerald-50 text-emerald-950",
      };
    case "failed":
    case "cancelled":
    case "interrupted":
      return {
        badge: "bg-red-100 text-red-800",
        panel: "border-red-200 bg-red-50 text-red-950",
      };
    default:
      return {
        badge: "bg-zinc-100 text-zinc-700",
        panel: "border-zinc-200 bg-zinc-50 text-zinc-950",
      };
  }
}
