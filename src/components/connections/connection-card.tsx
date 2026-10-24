"use client";

import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/components/ui/cn";
import { Alert, Badge } from "@/src/components/ui/feedback";
import { Field, Input, Toggle } from "@/src/components/ui/field";
import {
  IconDatabase,
  IconEye,
  IconEyeOff,
  IconLock,
  IconPencil,
  IconTrash,
} from "@/src/components/ui/icons";
import type { Connection, ConnectionEnvironment } from "@/src/types/models";

type ConnectionCardProps = {
  connection: Connection;
  onDelete: (id: string) => Promise<void>;
  onSave: (
    id: string,
    values: {
      name: string;
      mongoUrl?: string;
      locked: boolean;
      environment: ConnectionEnvironment;
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
  const [environment, setEnvironment] = useState<ConnectionEnvironment>(
    connection.environment ?? "local",
  );
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);

    try {
      await onSave(connection.id, {
        name,
        mongoUrl: mongoUrl || undefined,
        locked,
        environment,
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
    <article
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface p-5 shadow-card transition hover:shadow-[0_6px_20px_-10px_rgb(15_26_20/0.18)]",
        isEditing ? "border-sync ring-4 ring-sync/10" : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              connection.locked ? "bg-ink text-paper" : "bg-sync-wash text-sync",
            )}
          >
            <IconDatabase size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-[15px] font-semibold text-ink">
                {connection.name}
              </h3>
              <Badge tone="neutral" className="uppercase">
                {connection.environment ?? "local"}
              </Badge>
              {connection.locked ? (
                <Badge tone="amber" icon={<IconLock size={11} />}>
                  Locked
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-subtle">
              Updated {new Date(connection.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            aria-label={isEditing ? "Cancel editing" : "Edit connection"}
            title={isEditing ? "Cancel" : "Edit"}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition",
              isEditing ? "bg-sync-wash text-sync" : "text-subtle hover:bg-ink/5 hover:text-ink",
            )}
          >
            <IconPencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(connection.id)}
            disabled={connection.locked}
            aria-label="Delete connection"
            title={connection.locked ? "Unlock the connection to delete it" : "Delete"}
            className="flex size-8 items-center justify-center rounded-lg text-subtle transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-subtle"
          >
            <IconTrash size={15} />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-5 grid animate-fade-in gap-4 border-t border-line pt-5">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field label="New Mongo URL" hint="Leave blank to keep the existing encrypted value.">
            <Input
              value={mongoUrl}
              onChange={(event) => setMongoUrl(event.target.value)}
              placeholder="mongodb+srv://…"
              className="font-mono text-[13px]"
            />
          </Field>

          <Field label="Environment">
            <select
              value={environment}
              onChange={(event) =>
                setEnvironment(event.target.value as ConnectionEnvironment)
              }
              className="h-10 w-full rounded-[10px] border border-line bg-paper px-3 text-[13px] text-ink"
            >
              <option value="local">local</option>
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="prod">prod</option>
            </select>
          </Field>

          <Toggle
            checked={locked}
            onChange={setLocked}
            label="Lock this connection"
            description="Locked targets need a typed confirmation and can't be overridden."
          />

          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} loading={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-2">
          <div
            className={cn(
              "flex min-w-0 gap-2 overflow-hidden rounded-xl border border-line bg-paper py-1.5 pl-3 pr-1.5",
              revealedMongoUrl ? "items-start" : "items-center",
            )}
          >
            <p
              className={cn(
                "min-w-0 flex-1 overflow-hidden font-mono text-xs text-muted",
                revealedMongoUrl
                  ? "max-h-24 overflow-y-auto break-all py-1 [overflow-wrap:anywhere]"
                  : "truncate",
              )}
              title={
                revealedMongoUrl ??
                connection.mongoUrlPreview ??
                undefined
              }
            >
              {revealedMongoUrl ?? connection.mongoUrlPreview ?? "••••••••••••••••••"}
            </p>
            <button
              type="button"
              onClick={() => {
                void handleToggleMongoUrlVisibility();
              }}
              disabled={isRevealingMongoUrl}
              aria-label={revealedMongoUrl ? "Hide URL" : "Show URL"}
              title={revealedMongoUrl ? "Hide URL" : "Show URL"}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-subtle transition hover:bg-surface hover:text-ink disabled:opacity-50"
            >
              {revealedMongoUrl ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </button>
          </div>
          {revealError ? <Alert tone="danger">{revealError}</Alert> : null}
        </div>
      )}
    </article>
  );
}
