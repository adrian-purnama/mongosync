import type { ReactNode } from "react";

import { cn } from "./cn";

type CardProps = {
  className?: string;
  children: ReactNode;
};

export function Card({ className, children }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function CardHeader({ title, description, icon, actions, className }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sync-wash text-sync">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 font-display text-[11px] font-medium uppercase tracking-[0.2em] text-sync">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
};

type SegmentedProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
};

/** Pill-style single choice control. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex rounded-xl bg-ink/5 p-1 ring-1 ring-inset ring-ink/5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-[9px] px-3.5 text-[13px] font-medium transition",
              active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Larger choice cards, each with a short description. */
export function ChoiceCards<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "group relative grid gap-1 rounded-xl border p-3 text-left transition",
              active
                ? "border-sync bg-sync-wash/60 ring-4 ring-sync/10"
                : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">{option.label}</span>
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border transition",
                  active ? "border-sync bg-sync" : "border-line-strong bg-surface",
                )}
              >
                {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
            </span>
            {option.description ? (
              <span className="text-xs leading-[1.45] text-muted">{option.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
