import { cn } from "@/src/components/ui/cn";

type Tone = "light" | "dark";

const palette = {
  light: {
    prod: "#0F1A14",
    prodTop: "#34453B",
    copy: "#1F8A5B",
    copyTop: "#4FB386",
    band: "#F6F7F5",
    arrow: "#1F8A5B",
  },
  dark: {
    prod: "#F6F7F5",
    prodTop: "#C9D2CC",
    copy: "#4FD18F",
    copyTop: "#9BE8BF",
    band: "#0F1A14",
    arrow: "#4FD18F",
  },
} as const;

type LogoMarkProps = {
  tone?: Tone;
  size?: number;
  className?: string;
  title?: string;
};

/** The "Replica" mark: prod cylinder → copy cylinder, joined by a sync arrow. */
export function LogoMark({ tone = "light", size = 32, className, title }: LogoMarkProps) {
  const c = palette[tone];

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M14 34 V70 A24 8 0 0 0 62 70 V34 Z" fill={c.prod} />
      <ellipse cx="38" cy="34" rx="24" ry="8" fill={c.prodTop} />
      <path d="M14 52 A24 8 0 0 0 62 52" fill="none" stroke={c.band} strokeWidth="2.5" />
      <path d="M58 58 V94 A24 8 0 0 0 106 94 V58 Z" fill={c.copy} />
      <ellipse cx="82" cy="58" rx="24" ry="8" fill={c.copyTop} />
      <path d="M58 76 A24 8 0 0 0 106 76" fill="none" stroke={c.band} strokeWidth="2.5" />
      <path
        d="M40 18 C52 6 76 8 82 40"
        fill="none"
        stroke={c.arrow}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <polyline
        points="75,34 82,43 89,34"
        fill="none"
        stroke={c.arrow}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rounded ink tile version of the mark, used as the app icon. */
export function AppIcon({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="120" height="120" rx="28" fill="#0F1A14" />
      <g transform="translate(18 20) scale(0.7)">
        <path d="M14 34 V70 A24 8 0 0 0 62 70 V34 Z" fill="#F6F7F5" />
        <ellipse cx="38" cy="34" rx="24" ry="8" fill="#C9D2CC" />
        <path d="M58 58 V94 A24 8 0 0 0 106 94 V58 Z" fill="#4FD18F" />
        <ellipse cx="82" cy="58" rx="24" ry="8" fill="#9BE8BF" />
        <path
          d="M40 18 C52 6 76 8 82 40"
          fill="none"
          stroke="#4FD18F"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <polyline
          points="75,34 82,43 89,34"
          fill="none"
          stroke="#4FD18F"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

type WordmarkProps = {
  tone?: Tone;
  className?: string;
};

export function Wordmark({ tone = "light", className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "font-display font-semibold leading-none tracking-[-0.03em]",
        tone === "light" ? "text-ink" : "text-paper",
        className,
      )}
    >
      Mongo
      <span className={tone === "light" ? "text-sync" : "text-sync-glow"}>Sync</span>
    </span>
  );
}

type LogoProps = {
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  className?: string;
};

const sizes = {
  sm: { mark: 28, word: "text-lg", tag: "text-[8px]", gap: "gap-2" },
  md: { mark: 36, word: "text-[22px]", tag: "text-[9px]", gap: "gap-2.5" },
  lg: { mark: 60, word: "text-[42px]", tag: "text-xs", gap: "gap-4" },
} as const;

/** Lockup: mark + wordmark, optionally with the "Local-first Mongo utility" tagline. */
export function Logo({ tone = "light", size = "md", tagline = false, className }: LogoProps) {
  const s = sizes[size];

  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      <LogoMark tone={tone} size={s.mark} />
      <span className="flex flex-col gap-1">
        <Wordmark tone={tone} className={s.word} />
        {tagline ? (
          <span
            className={cn(
              "font-display uppercase leading-none tracking-[0.2em]",
              s.tag,
              tone === "light" ? "text-muted" : "text-fog",
            )}
          >
            Local-first Mongo utility
          </span>
        ) : null}
      </span>
    </span>
  );
}
