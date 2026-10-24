import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

type Variant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-soft"
  | "warning"
  | "glow"
  | "light"
  | "outline-dark";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-[background-color,color,box-shadow,border-color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper shadow-[0_1px_0_rgb(255_255_255/0.08)_inset] hover:bg-ink-3",
  accent:
    "bg-sync text-white shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-8px_rgb(31_138_91/0.8)] hover:bg-sync-strong",
  secondary:
    "border border-line bg-surface text-ink shadow-card hover:border-line-strong hover:bg-paper",
  ghost: "text-muted hover:bg-ink/5 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
  "danger-soft": "border border-red-200 bg-surface text-red-700 hover:bg-red-50",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
  // For use on ink backgrounds
  glow: "bg-sync-glow text-ink shadow-[0_8px_24px_-8px_rgb(79_209_143/0.6)] hover:bg-sync-mist",
  light: "bg-paper text-ink hover:bg-white",
  "outline-dark": "border border-white/15 bg-white/5 text-paper hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
  icon: "size-10 text-sm",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
};

export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
