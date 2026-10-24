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

  useEffect(() => {
    if (!desktop) {
      return;
    }

    document.documentElement.classList.add("is-desktop");
    void desktop.windowControls.isMaximized().then(setMaximized);
    const unsubscribe = desktop.windowControls.onMaximizedChange(setMaximized);

    return () => {
      unsubscribe();
      document.documentElement.classList.remove("is-desktop");
    };
  }, [desktop]);

  if (!desktop) {
    return null;
  }

  const dark = DARK_TOP_ROUTES.has(pathname);
  const controls = desktop.windowControls;

  return (
    <>
      <div aria-hidden className="titlebar-drag" />
      <div
        className={cn(
          "titlebar-controls fixed right-0 top-0 z-[100] flex h-[var(--titlebar-height)]",
          dark ? "text-fog" : "text-muted",
        )}
      >
        <ControlButton label="Minimize" dark={dark} onClick={controls.minimize}>
          <path d="M1 5.5h9" />
        </ControlButton>
        <ControlButton
          label={maximized ? "Restore" : "Maximize"}
          dark={dark}
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
        <ControlButton label="Close" dark={dark} onClick={controls.close} danger>
          <path d="m1.5 1.5 8 8M9.5 1.5l-8 8" />
        </ControlButton>
      </div>
    </>
  );
}

function ControlButton({
  label,
  dark,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  dark: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-full w-[46px] items-center justify-center transition-colors duration-100",
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
