import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

export const inputClass =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink shadow-card outline-none transition placeholder:text-subtle hover:border-line-strong focus:border-sync focus:ring-4 focus:ring-sync/12 disabled:cursor-not-allowed disabled:bg-paper disabled:text-subtle";

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Switch-style checkbox with a label and optional helper text. */
export function Toggle({ checked, onChange, label, description, className }: ToggleProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 select-none", className)}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition peer-focus-visible:ring-4 peer-focus-visible:ring-sync/20",
          checked ? "bg-sync" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
