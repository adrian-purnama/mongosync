"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/src/components/ui/cn";

// Routes whose top-right corner sits on an ink background.
const DARK_TOP_ROUTES = new Set(["/"]);

function subscribeNoop() {
  return () => {};
}

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.mongosyncDesktop;
}

/**
 * Title bar for the frameless Electron window: an invisible drag strip across the
 * top of every page plus minimize / maximize / close buttons in the top-right.
 * Renders nothing in a regular browser.
 */
export function WindowControls() {
  const desktop = useSyncExternalStore(subscribeNoop, getDesktopBridge, () => undefined);
  const pathname = usePathname();
  const [maximized, setMaximized] = useState(false);
  const [shutdown, setShutdown] = useState<{
    percent: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!desktop) {
      return;
    }

    document.documentElement.classList.add("is-desktop");
    void desktop.windowControls.isMaximized().then(setMaximized);
    const unsubscribeMaximized = desktop.windowControls.onMaximizedChange(setMaximized);
    const unsubscribeProgress = desktop.onShutdownProgress((progress) => {
      setShutdown(progress);
    });
    const unsubscribeCancelled = desktop.onShutdownCancelled(() => {
      setShutdown(null);
    });

    return () => {
      unsubscribeMaximized();
      unsubscribeProgress();
      unsubscribeCancelled();
      document.documentElement.classList.remove("is-desktop");
    };
  }, [desktop]);

  if (!desktop) {
    return null;
  }

  const dark = DARK_TOP_ROUTES.has(pathname);
  const controls = desktop.windowControls;
  const shuttingDown = Boolean(shutdown);

  return (
    <>
      <div aria-hidden className="titlebar-drag" />
      <div
        className={cn(
          "titlebar-controls fixed right-0 top-0 z-[100] flex h-[var(--titlebar-height)]",
          dark ? "text-fog" : "text-muted",
        )}
      >
        <ControlButton
          label="Minimize"
          dark={dark}
          disabled={shuttingDown}
          onClick={controls.minimize}
        >
          <path d="M1 5.5h9" />
        </ControlButton>
        <ControlButton
          label={maximized ? "Restore" : "Maximize"}
          dark={dark}
          disabled={shuttingDown}
          onClick={controls.toggleMaximize}
        >
          {maximized ? (
            <>
              <rect x="1" y="3" width="7" height="7" rx="1.2" />
              <path d="M3.5 3V2.2A1.2 1.2 0 0 1 4.7 1H9a1.2 1.2 0 0 1 1.2 1.2v4.3A1.2 1.2 0 0 1 9 7.7h-.8" />
            </>
          ) : (
            <rect x="1" y="1" width="9" height="9" rx="1.5" />
          )}
        </ControlButton>
        <ControlButton
          label="Close"
          dark={dark}
          disabled={shuttingDown}
          onClick={controls.close}
          danger
        >
          <path d="m1.5 1.5 8 8M9.5 1.5l-8 8" />
        </ControlButton>
      </div>

      {shutdown ? <ShutdownOverlay percent={shutdown.percent} message={shutdown.message} /> : null}
    </>
  );
}

function ShutdownOverlay({ percent, message }: { percent: number; message: string }) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-paper/92 px-6 backdrop-blur-sm"
      role="alertdialog"
      aria-live="polite"
      aria-busy="true"
      aria-label="Shutting down"
    >
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span
            className="size-5 shrink-0 animate-spin rounded-full border-2 border-ink/15 border-t-sync"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
              Shutting down
            </p>
            <p className="mt-0.5 truncate text-sm text-muted">{message || "Please wait…"}</p>
          </div>
          <p className="ml-auto font-mono text-sm tabular-nums text-ink">{clamped}%</p>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/8">
          <div
            className="h-full rounded-full bg-sync transition-[width] duration-200 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  dark,
  danger = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  dark: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-full w-[46px] items-center justify-center transition-colors duration-100",
        disabled && "pointer-events-none opacity-40",
        danger
          ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#a52314]"
          : dark
            ? "hover:bg-white/10 hover:text-paper active:bg-white/5"
            : "hover:bg-ink/[0.06] hover:text-ink active:bg-ink/10",
      )}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 11 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}
