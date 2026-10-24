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
  IconUnlock,
} from "@/src/components/ui/icons";

type UnlockScreenProps = {
  hasUser: boolean;
  hasRecovery: boolean;
  recoveryQuestion: string | null;
};

export function UnlockScreen({
  hasUser,
  hasRecovery,
  recoveryQuestion,
}: UnlockScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [addRecovery, setAddRecovery] = useState(false);
  const [recoveryQuestionInput, setRecoveryQuestionInput] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [confirmRecoveryAnswer, setConfirmRecoveryAnswer] = useState("");
  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [recoverPassword, setRecoverPassword] = useState("");
  const [confirmRecoverPassword, setConfirmRecoverPassword] = useState("");
  const [recoverError, setRecoverError] = useState("");

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

      if (!hasUser && addRecovery) {
        if (recoveryAnswer !== confirmRecoveryAnswer) {
          throw new Error("Recovery answers do not match.");
        }
      }

      const endpoint = hasUser ? "/api/auth/unlock" : "/api/auth/setup";
      const body = hasUser
        ? { password }
        : {
            password,
            ...(addRecovery
              ? {
                  recoveryQuestion: recoveryQuestionInput,
                  recoveryAnswer,
                }
              : {}),
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

  function closeRecoverModal() {
    setShowRecoverModal(false);
    setRecoverAnswer("");
    setRecoverPassword("");
    setConfirmRecoverPassword("");
    setRecoverError("");
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
              : "This password encrypts your connection strings. You can optionally add a recovery question to reset it later without deleting data."}
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

            {!hasUser ? (
              <div className="rounded-xl border border-line bg-surface/60 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={addRecovery}
                    onChange={(event) => setAddRecovery(event.target.checked)}
                    className="mt-1 size-4 accent-[var(--sync)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      Add recovery question
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-muted">
                      Lets you reset the master password later without deleting saved
                      connections. Answers are normalized (lowercase, no spaces).
                    </span>
                  </span>
                </label>

                {addRecovery ? (
                  <div className="mt-4 grid gap-3">
                    <Field label="Recovery question">
                      <Input
                        value={recoveryQuestionInput}
                        onChange={(event) =>
                          setRecoveryQuestionInput(event.target.value)
                        }
                        placeholder="e.g. What city were you born in?"
                        required
                      />
                    </Field>
                    <Field label="Recovery answer">
                      <Input
                        value={recoveryAnswer}
                        onChange={(event) => setRecoveryAnswer(event.target.value)}
                        autoComplete="off"
                        required
                      />
                    </Field>
                    <Field label="Confirm answer">
                      <Input
                        value={confirmRecoveryAnswer}
                        onChange={(event) =>
                          setConfirmRecoveryAnswer(event.target.value)
                        }
                        autoComplete="off"
                        required
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
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
            <div className="mt-10 grid gap-3 border-t border-line pt-5">
              <p className="text-[13px] text-muted">Forgot your password?</p>
              <div className="flex flex-wrap items-center gap-2">
                {hasRecovery ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRecoverModal(true)}
                    icon={<IconUnlock size={14} />}
                  >
                    Recover with security question
                  </Button>
                ) : null}
                <Button
                  variant="danger-soft"
                  size="sm"
                  onClick={() => setShowResetModal(true)}
                  icon={<IconTrash size={14} />}
                >
                  Reset all data
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Modal
        title="Recover master password"
        description="Answer your recovery question, then choose a new master password. Saved connections are kept and re-encrypted."
        isOpen={showRecoverModal}
        onClose={closeRecoverModal}
        icon={<IconUnlock size={18} />}
      >
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setRecoverError("");

            if (recoverPassword !== confirmRecoverPassword) {
              setRecoverError("New passwords do not match.");
              return;
            }

            setIsRecovering(true);

            try {
              const response = await fetch("/api/auth/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  answer: recoverAnswer,
                  password: recoverPassword,
                }),
              });
              const payload = (await response.json()) as { error?: string };

              if (!response.ok) {
                throw new Error(payload.error ?? "Recovery failed.");
              }

              closeRecoverModal();
              router.push("/workspace");
              router.refresh();
            } catch (submitRecoverError) {
              setRecoverError(
                submitRecoverError instanceof Error
                  ? submitRecoverError.message
                  : "Recovery failed.",
              );
            } finally {
              setIsRecovering(false);
            }
          }}
        >
          <Field label="Your question">
            <p className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink">
              {recoveryQuestion}
            </p>
          </Field>
          <Field label="Your answer">
            <Input
              value={recoverAnswer}
              onChange={(event) => setRecoverAnswer(event.target.value)}
              autoComplete="off"
              autoFocus
              required
            />
          </Field>
          <Field label="New master password">
            <Input
              type="password"
              value={recoverPassword}
              onChange={(event) => setRecoverPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmRecoverPassword}
              onChange={(event) => setConfirmRecoverPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {recoverError ? <Alert tone="danger">{recoverError}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={closeRecoverModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isRecovering}>
              {isRecovering ? "Recovering..." : "Reset password"}
            </Button>
          </div>
        </form>
      </Modal>

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
