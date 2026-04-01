"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/src/components/shared/modal";

type UnlockScreenProps = {
  hasUser: boolean;
};

export function UnlockScreen({ hasUser }: UnlockScreenProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  const heading = useMemo(
    () => (hasUser ? "Unlock MongoSync Local" : "Create your master password"),
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex justify-end">
          <Link
            href="/"
            aria-label="How this app works"
            title="How this app works"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            ?
          </Link>
        </div>
        <div className="mb-6 flex flex-col items-start gap-3">
        <Image
              src="/assets/logo only.png"
              alt=""
              width={200}
              height={200}
              className="w-30 object-contain"
              aria-hidden="true"
            />
          <Image
            src="/assets/name only.png"
            alt="MongoSync Local"
            width={260}
            height={52}
            className="h-auto w-20"
            priority
          />
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Local-only access
          </div>
        </div>
        <h1 className="mb-3 text-3xl font-semibold text-zinc-950">{heading}</h1>
        <p className="mb-6 text-sm leading-6 text-zinc-600">
          The master password unlocks encrypted MongoDB connection strings stored on
          this machine.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-zinc-700">
            Master password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2"
              required
            />
          </label>

          {!hasUser ? (
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2"
                required
              />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {isSubmitting
              ? "Working..."
              : hasUser
                ? "Unlock"
                : "Create password"}
          </button>
        </form>

        {hasUser ? (
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Reset all data
            </button>
          </div>
        ) : null}
      </div>

      <Modal
        title="Reset all local data"
        description="This will delete your master password, organizations, connections, and persisted jobs. Type RESET to continue."
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetConfirmText("");
        }}
      >
        <div className="grid gap-3">
          <input
            value={resetConfirmText}
            onChange={(event) => setResetConfirmText(event.target.value)}
            placeholder="Type RESET"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setResetConfirmText("");
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResetting || resetConfirmText !== "RESET"}
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
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isResetting ? "Resetting..." : "Delete all data"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
