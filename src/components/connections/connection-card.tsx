"use client";

import { useState } from "react";

import type { Connection } from "@/src/types/models";

type ConnectionCardProps = {
  connection: Connection;
  onDelete: (id: string) => Promise<void>;
  onSave: (
    id: string,
    values: {
      name: string;
      mongoUrl?: string;
      locked: boolean;
      organizationId: string;
    },
  ) => Promise<void>;
};

export function ConnectionCard({
  connection,
  onDelete,
  onSave,
}: ConnectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(connection.name);
  const [mongoUrl, setMongoUrl] = useState("");
  const [revealedMongoUrl, setRevealedMongoUrl] = useState<string | null>(null);
  const [isRevealingMongoUrl, setIsRevealingMongoUrl] = useState(false);
  const [revealError, setRevealError] = useState("");
  const [locked, setLocked] = useState(connection.locked);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSave(connection.id, {
        name,
        mongoUrl: mongoUrl || undefined,
        locked,
        organizationId: connection.organizationId,
      });
      setMongoUrl("");
      setRevealedMongoUrl(null);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleMongoUrlVisibility() {
    setRevealError("");

    if (revealedMongoUrl) {
      setRevealedMongoUrl(null);
      return;
    }

    setIsRevealingMongoUrl(true);

    try {
      const response = await fetch(`/api/connections/${connection.id}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | { mongoUrl: string }
        | { error: string };

      if (!response.ok || !("mongoUrl" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to reveal Mongo URL.",
        );
      }

      setRevealedMongoUrl(payload.mongoUrl);
    } catch (error) {
      setRevealError(
        error instanceof Error ? error.message : "Failed to reveal Mongo URL.",
      );
    } finally {
      setIsRevealingMongoUrl(false);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-950">{connection.name}</h3>
            {connection.locked ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                Locked
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Updated {new Date(connection.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(connection.id)}
            disabled={connection.locked}
            className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            New Mongo URL
            <input
              value={mongoUrl}
              onChange={(event) => setMongoUrl(event.target.value)}
              placeholder="Leave blank to keep existing encrypted value"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={locked}
              onChange={(event) => setLocked(event.target.checked)}
            />
            Lock this connection
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 text-sm text-zinc-600">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Saved Mongo URL
            </p>
            <p className="break-all font-mono text-xs text-zinc-700">
              {revealedMongoUrl ?? connection.mongoUrlPreview ?? "******************"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void handleToggleMongoUrlVisibility();
              }}
              disabled={isRevealingMongoUrl}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {isRevealingMongoUrl
                ? "Loading..."
                : revealedMongoUrl
                  ? "Hide URL"
                  : "Show URL"}
            </button>
          </div>
          {revealError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {revealError}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
