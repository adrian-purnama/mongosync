import type { ReactNode } from "react";

import type { CopyJobStatus } from "@/src/types/models";

import { cn } from "./cn";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";

type Tone = "info" | "success" | "warning" | "danger";

const alertTones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <IconInfo className="text-sky-600" />,
  },
  success: {
    box: "border-sync/25 bg-sync-wash text-sync-strong",
    icon: <IconCheck className="text-sync" />,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <IconAlert className="text-amber-600" />,
  },
  danger: {
    box: "border-red-200 bg-red-50 text-red-800",
    icon: <IconX className="text-red-600" />,
  },
};

type AlertProps = {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const t = alertTones[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex animate-fade-in gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-5",
        t.box,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="grid gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue" | "ink";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-ink/5 text-muted ring-ink/10",
  green: "bg-sync-wash text-sync-strong ring-sync/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20",
  ink: "bg-ink text-paper ring-ink",
};

type BadgeProps = {
  tone?: BadgeTone;
  icon?: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "neutral", icon, dot, pulse, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5">
          {pulse ? (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          ) : null}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {icon}
      {children}
    </span>
  );
}

const statusTones: Record<CopyJobStatus, BadgeTone> = {
  queued: "neutral",
  running: "blue",
  paused: "amber",
  verifying: "blue",
  swapping: "blue",
  completed: "green",
  failed: "red",
  cancelled: "neutral",
  reverted: "amber",
  interrupted: "amber",
};

export function StatusBadge({ status }: { status: CopyJobStatus }) {
  const pulsing =
    status === "running" || status === "verifying" || status === "swapping";

  return (
    <Badge tone={statusTones[status]} dot pulse={pulsing} className="capitalize">
      {status}
    </Badge>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-paper/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-muted shadow-card ring-1 ring-line">
        {icon}
      </span>
      <div className="grid gap-1">
        <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
        {children ? <p className="max-w-sm text-[13px] text-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
