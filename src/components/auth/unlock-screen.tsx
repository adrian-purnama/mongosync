"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo, LogoMark } from "@/src/components/brand/logo";
import { Modal } from "@/src/components/shared/modal";
import { Button } from "@/src/components/ui/button";
import { Alert } from "@/src/components/ui/feedback";
import { Field, Input } from "@/src/components/ui/field";
import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconHelp,
  IconShield,
  IconTrash,
} from "@/src/components/ui/icons";

type UnlockScreenProps = {
  hasUser: boolean;
};

export function UnlockScreen({ hasUser }: UnlockScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const heading = useMemo(
    () => (hasUser ? "Welcome back" : "Create your master password"),
    [hasUser],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!hasUser && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const endpoint = hasUser ? "/api/auth/unlock" : "/api/auth/setup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Authentication failed.");
      }

      router.push("/workspace");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeResetModal() {
    setShowResetModal(false);
    setResetConfirmText("");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-paper lg:flex lg:flex-col">
        <div className="bg-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black_20%,transparent_70%)]" />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-sync/30 blur-[110px]" />

        <Link href="/" className="relative">
          <Logo tone="dark" size="md" tagline />
        </Link>

        <div className="relative my-auto max-w-md">
          <LogoMark tone="dark" size={88} />
          <h2 className="mt-8 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.035em]">
            Your connections never leave this machine.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-fog">
            The master password derives the key that decrypts your saved MongoDB connection
            strings. It&apos;s never sent anywhere.
          </p>
        </div>

        <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-sync-glow/15 text-sync-glow">
            <IconShield size={18} />
          </span>
          <p className="text-[13px] leading-5 text-fog">
            AES-256-GCM encryption with a scrypt-derived key, stored in{" "}
            <span className="font-mono text-paper">%APPDATA%</span>.
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col bg-paper px-6 pb-8 pt-[calc(var(--titlebar-height)+2rem)] sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:invisible">
            <Logo size="sm" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <IconHelp size={15} />
            How it works
          </Link>
        </div>

        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-sync">
            {hasUser ? "Local-only access" : "First-time setup"}
          </p>
          <h1 className="mt-3 font-display text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink">
            {heading}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {hasUser
              ? "Enter your master password to unlock your encrypted connections."
              : "This password encrypts your connection strings. There's no recovery if you forget it, so pick one you'll remember."}
          </p>

          <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
            <Field label="Master password">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 pr-11"
                  autoFocus
                  autoComplete={hasUser ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition hover:bg-ink/5 hover:text-ink"
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </Field>

            {!hasUser ? (
              <Field label="Confirm password">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11"
                  autoComplete="new-password"
                  required
                />
              </Field>
            ) : null}

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="mt-2 w-full"
            >
              {isSubmitting ? "Working..." : hasUser ? "Unlock" : "Create password"}
              {isSubmitting ? null : <IconArrowRight />}
            </Button>
          </form>

          {hasUser ? (
            <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-5">
              <p className="text-[13px] text-muted">Forgot your password?</p>
              <Button
                variant="danger-soft"
                size="sm"
                onClick={() => setShowResetModal(true)}
                icon={<IconTrash size={14} />}
              >
                Reset all data
              </Button>
            </div>
          ) : null}
        </div>
      </main>

      <Modal
        title="Reset all local data"
        description="This deletes your master password, organizations, connections, and persisted jobs. It can't be undone. Type RESET to continue."
        isOpen={showResetModal}
        onClose={closeResetModal}
        icon={<IconTrash size={18} />}
        tone="danger"
      >
        <div className="grid gap-4">
          <Input
            value={resetConfirmText}
            onChange={(event) => setResetConfirmText(event.target.value)}
            placeholder="Type RESET"
            className="font-mono"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button onClick={closeResetModal}>Cancel</Button>
            <Button
              variant="danger"
              loading={isResetting}
              disabled={resetConfirmText !== "RESET"}
              onClick={async () => {
                setError("");
                setIsResetting(true);

                try {
                  const response = await fetch("/api/auth/reset-all", {
                    method: "POST",
                  });
                  const payload = (await response.json()) as { error?: string };

                  if (!response.ok) {
                    throw new Error(payload.error ?? "Failed to reset data.");
                  }

                  setShowResetModal(false);
                  setResetConfirmText("");
                  setPassword("");
                  setConfirmPassword("");
                  router.refresh();
                } catch (resetError) {
                  setError(
                    resetError instanceof Error
                      ? resetError.message
                      : "Failed to reset data.",
                  );
                } finally {
                  setIsResetting(false);
                }
              }}
            >
              {isResetting ? "Resetting..." : "Delete all data"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
