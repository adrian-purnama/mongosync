"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/src/components/ui/cn";
import { IconX } from "@/src/components/ui/icons";

type ModalProps = {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "danger";
};

const iconTones = {
  default: "bg-sync-wash text-sync",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
};

export function Modal({
  title,
  description,
  isOpen,
  onClose,
  children,
  icon,
  tone = "default",
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/45 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md animate-pop-in rounded-[20px] border border-line bg-surface p-6 shadow-pop"
      >
        <div className="mb-5 flex items-start gap-3.5">
          {icon ? (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                iconTones[tone],
              )}
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h3>
            <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle transition hover:bg-ink/5 hover:text-ink"
          >
            <IconX />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
