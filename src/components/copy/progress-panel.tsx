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
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
          {job.status}
        </span>
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
