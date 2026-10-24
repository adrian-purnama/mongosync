"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Alert, StatusBadge } from "@/src/components/ui/feedback";
import { IconDownload, IconRefresh, IconTerminal, IconX } from "@/src/components/ui/icons";
import type { CopyJob, CopyJobLogLevel, CopyJobStatus } from "@/src/types/models";

type ProgressPanelProps = {
  job: CopyJob | null;
  error: string | null;
  onCancel?: (jobId: string) => Promise<void> | void;
  onResume?: (jobId: string) => Promise<void> | void;
  onRevert?: (jobId: string) => Promise<void> | void;
  isCancelling?: boolean;
  isResuming?: boolean;
  isReverting?: boolean;
};

const logLevelClass: Record<CopyJobLogLevel, string> = {
  info: "text-sync-glow",
  warning: "text-amber-300",
  error: "text-red-400",
};

const barClass: Record<CopyJobStatus, string> = {
  queued: "bg-fog",
  running: "bg-sync progress-stripes animate-stripes",
  paused: "bg-amber-500",
  verifying: "bg-sync progress-stripes animate-stripes",
  swapping: "bg-sync progress-stripes animate-stripes",
  completed: "bg-sync",
  failed: "bg-red-500",
  cancelled: "bg-fog",
  reverted: "bg-amber-500",
  interrupted: "bg-amber-500",
};

const ACTIVE_STATUSES = new Set<CopyJobStatus>([
  "queued",
  "running",
  "verifying",
  "swapping",
]);

export function ProgressPanel({
  job,
  error,
  onCancel,
  onResume,
  onRevert,
  isCancelling = false,
  isResuming = false,
  isReverting = false,
}: ProgressPanelProps) {
  const logRef = useRef<HTMLDivElement | null>(null);
  const logCount = job?.logs.length ?? 0;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logCount]);

  if (error) {
    return (
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
        <Alert tone="danger" title="Couldn't load job">
          {error}
        </Alert>
      </section>
    );
  }

  if (!job) {
    return (
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-6 text-paper">
        <div className="bg-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]" />
        <div className="relative">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/5 text-sync-glow ring-1 ring-white/10">
            <IconTerminal size={18} />
          </span>
          <h3 className="mt-5 font-display text-[17px] font-semibold">Job monitor</h3>
          <p className="mt-1.5 text-[13px] leading-5 text-fog">
            Start a copy or export to watch progress and live logs here. You can also pick a
            job from the recent list below.
          </p>
          <div className="mt-6 grid gap-2 font-mono text-[11px] text-fog/40">
            <span>$ waiting for job…</span>
            <span className="inline-block h-3 w-1.5 animate-pulse bg-sync-glow/60" />
          </div>
        </div>
      </section>
    );
  }

  const hasTotal = job.totalDocuments !== null && job.totalDocuments > 0;
  const progress = hasTotal
    ? Math.min(100, Math.round((job.processedDocuments / (job.totalDocuments ?? 1)) * 100))
    : job.status === "completed" || job.status === "reverted"
      ? 100
      : 0;
  const isActive = ACTIVE_STATUSES.has(job.status);
  const canResume = job.status === "paused" && Boolean(onResume);
  const canRevert =
    job.status === "completed" &&
    (job.kind === "copy" || job.kind === "import") &&
    Boolean(onRevert);

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              {job.kind === "export"
                ? "Export progress"
                : job.kind === "import"
                  ? "Import progress"
                  : "Copy progress"}
            </p>
            <p className="mt-1.5 break-all font-mono text-[13px] leading-5 text-ink">
              {getJobSummary(job)}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[13px] text-muted">
              <span className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
                {job.processedDocuments.toLocaleString()}
              </span>
              {hasTotal
                ? ` of ${job.totalDocuments!.toLocaleString()} docs`
                : job.status === "running" || job.status === "paused"
                  ? " docs (estimating total…)"
                  : " docs"}
            </p>
            <span className="font-mono text-[13px] font-medium text-sync">
              {hasTotal ? `${progress}%` : "—"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-line">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barClass[job.status])}
              style={{
                width: `${
                  job.status === "completed" || job.status === "reverted"
                    ? 100
                    : hasTotal
                      ? progress
                      : isActive
                        ? 15
                        : 0
                }%`,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Source: {job.persistenceSource ?? "memory"}
            {job.lastPersistedAt
              ? ` · Saved ${new Date(job.lastPersistedAt).toLocaleTimeString()}`
              : ""}
            {job.backupBytesEstimate
              ? ` · Backup ~${formatBytes(job.backupBytesEstimate)}`
              : ""}
          </p>
        </div>

        {job.lock ? (
          <div className="mt-4">
            <Alert tone="info" title="Target locked for MongoSync writes">
              Readers still see the previous data until swap. Lock owner {job.lock.owner} · job{" "}
              {job.lock.jobId.slice(0, 8)}…
            </Alert>
          </div>
        ) : null}

        {job.error || job.interruptedReason || (job.cancelRequestedAt && job.status !== "cancelled") ? (
          <div className="mt-4 grid gap-2">
            {job.error ? <Alert tone="danger">{job.error}</Alert> : null}
            {job.status === "paused" ? (
              <Alert tone="warning">
                Job is paused and can be resumed from the last checkpoint
                {job.interruptedReason
                  ? ` (${job.interruptedReason.replace(/_/g, " ")})`
                  : ""}
                .
              </Alert>
            ) : job.interruptedReason ? (
              <Alert tone="warning">
                This job was interrupted: {job.interruptedReason.replace(/_/g, " ")}.
              </Alert>
            ) : null}
            {job.cancelRequestedAt && job.status !== "cancelled" ? (
              <Alert tone="warning">
                Cancellation requested. The job will stop after the current safe step finishes.
              </Alert>
            ) : null}
          </div>
        ) : null}

        {(onCancel && isActive) ||
        canResume ||
        canRevert ||
        (job.kind === "export" && job.resultAvailable && job.status === "completed") ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {onCancel && isActive ? (
              <Button
                variant="danger-soft"
                size="sm"
                icon={<IconX size={14} />}
                onClick={() => {
                  void onCancel(job.id);
                }}
                disabled={Boolean(job.cancelRequestedAt) || isCancelling}
              >
                {job.cancelRequestedAt || isCancelling ? "Cancelling..." : "Cancel job"}
              </Button>
            ) : null}
            {canResume ? (
              <Button
                variant="accent"
                size="sm"
                icon={<IconRefresh size={14} />}
                onClick={() => {
                  void onResume?.(job.id);
                }}
                disabled={isResuming}
              >
                {isResuming ? "Resuming..." : "Resume"}
              </Button>
            ) : null}
            {canRevert ? (
              <Button
                variant="danger-soft"
                size="sm"
                onClick={() => {
                  void onRevert?.(job.id);
                }}
                disabled={isReverting}
              >
                {isReverting ? "Reverting..." : "Revert"}
              </Button>
            ) : null}
            {job.kind === "export" && job.resultAvailable && job.status === "completed" ? (
              <a
                href={`/api/export/jobs/${job.id}/download`}
                className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-sync px-3 text-[13px] font-medium text-white transition hover:bg-sync-strong"
              >
                <IconDownload size={14} />
                Download {job.artifactFileName ?? "export"}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/5 bg-ink">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-[11px] text-fog/70">
            <IconTerminal size={13} />
            logs
          </span>
          <span className="font-mono text-[11px] text-fog/50">{job.logs.length} lines</span>
        </div>
        <div
          ref={logRef}
          className="scrollbar-thin max-h-72 overflow-auto px-4 pb-4 font-mono text-[11.5px] leading-[1.7]"
        >
          {job.logs.length === 0 ? (
            <p className="text-fog/40">No log output yet.</p>
          ) : (
            job.logs.map((log) => (
              <div key={`${log.timestamp}-${log.message}`} className="flex gap-2 text-fog">
                <span className="shrink-0 text-white/30">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn("w-11 shrink-0 font-semibold uppercase", logLevelClass[log.level])}>
                  {log.level === "warning" ? "warn" : log.level}
                </span>
                <span className="min-w-0 break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function getJobSummary(job: CopyJob) {
  if (job.kind === "export") {
    return `${job.sourceDatabase}.${job.sourceCollection} → ${job.artifactFileName ?? "ZIP artifact"}`;
  }

  if (job.kind === "import") {
    return `ZIP → ${job.targetDatabase}`;
  }

  return `${job.sourceDatabase}.${job.sourceCollection} → ${job.targetDatabase}.${job.targetCollection}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
