"use client";

import { useEffect, useMemo, useState } from "react";

import { ProgressPanel } from "@/src/components/copy/progress-panel";
import { OrganizationSelector } from "@/src/components/orgs/organization-selector";
import { Modal } from "@/src/components/shared/modal";
import {
  MultiSearchableDropdown,
  SearchableDropdown,
} from "@/src/components/shared/searchable-dropdown";
import { useCopyJob } from "@/src/hooks/use-copy-job";
import { useSelectedOrganization } from "@/src/hooks/use-selected-organization";
import type { Connection, CopyMode, CopyJob, Organization } from "@/src/types/models";

type ToolAction = "copy" | "export";

export function CopyToolPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [recentJobs, setRecentJobs] = useState<CopyJob[]>([]);
  const [sourceDatabases, setSourceDatabases] = useState<string[]>([]);
  const [targetDatabases, setTargetDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [sourceConnectionId, setSourceConnectionId] = useState("");
  const [targetConnectionId, setTargetConnectionId] = useState("");
  const [sourceDatabase, setSourceDatabase] = useState("");
  const [targetDatabase, setTargetDatabase] = useState("");
  const [sourceCollections, setSourceCollections] = useState<string[]>([]);
  const [action, setAction] = useState<ToolAction>("copy");
  const [mode, setMode] = useState<CopyMode>("override");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingJobId, setIsCancellingJobId] = useState<string | null>(null);
  const [showLockedTargetModal, setShowLockedTargetModal] = useState(false);
  const [lockedTargetConfirmation, setLockedTargetConfirmation] = useState("");
  const organizationIds = useMemo(
    () => organizations.map((organization) => organization.id),
    [organizations],
  );
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useSelectedOrganization(organizationIds);
  const { job, error: jobError } = useCopyJob(jobId);

  useEffect(() => {
    if (!job) {
      return;
    }

    setRecentJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)]);
  }, [job]);

  const filteredConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.organizationId === selectedOrganizationId,
      ),
    [connections, selectedOrganizationId],
  );
  const connectionOptions = filteredConnections.map((connection) => ({
    value: connection.id,
    label: `${connection.name}${connection.locked ? " (Locked)" : ""}`,
  }));
  const sourceDatabaseOptions = sourceDatabases.map((databaseName) => ({
    value: databaseName,
    label: databaseName,
  }));
  const targetDatabaseOptions = targetDatabases.map((databaseName) => ({
    value: databaseName,
    label: databaseName,
  }));
  const collectionOptions = collections.map((collectionName) => ({
    value: collectionName,
    label: collectionName,
  }));
  const modeOptions = [
    { value: "override", label: "Override" },
    { value: "append", label: "Append" },
    { value: "new", label: "Copy to new collection" },
  ] satisfies Array<{ value: CopyMode; label: string }>;
  const actionOptions = [
    { value: "copy", label: "Copy to DB" },
    { value: "export", label: "Export DB" },
  ] satisfies Array<{ value: ToolAction; label: string }>;
  const selectedTargetConnection =
    filteredConnections.find((connection) => connection.id === targetConnectionId) ?? null;
  const requiresLockedTargetConfirmation =
    action === "copy" && Boolean(selectedTargetConnection?.locked);

  useEffect(() => {
    void (async () => {
      try {
        const [organizationsResponse, connectionsResponse] = await Promise.all([
          fetch("/api/organizations", { cache: "no-store" }),
          fetch("/api/connections", { cache: "no-store" }),
        ]);

        const organizationsPayload = (await organizationsResponse.json()) as
          | Organization[]
          | { error: string };
        const connectionsPayload = (await connectionsResponse.json()) as
          | Connection[]
          | { error: string };

        if (!organizationsResponse.ok) {
          throw new Error(
            "error" in organizationsPayload
              ? organizationsPayload.error
              : "Failed to load organizations.",
          );
        }

        if (!connectionsResponse.ok) {
          throw new Error(
            "error" in connectionsPayload
              ? connectionsPayload.error
              : "Failed to load connections.",
          );
        }

        setOrganizations(organizationsPayload as Organization[]);
        setConnections(connectionsPayload as Connection[]);
        const jobsResponse = await fetch("/api/copy/jobs", { cache: "no-store" });
        const jobsPayload = (await jobsResponse.json()) as CopyJob[] | { error: string };

        if (jobsResponse.ok) {
          setRecentJobs(jobsPayload as CopyJob[]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
      }
    })();
  }, []);

  useEffect(() => {
    setSourceConnectionId("");
    setTargetConnectionId("");
    setSourceDatabase("");
    setTargetDatabase("");
    setSourceDatabases([]);
    setTargetDatabases([]);
    setSourceCollections([]);
    setCollections([]);
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
  }, [selectedOrganizationId]);

  useEffect(() => {
    setError("");
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
  }, [action]);

  useEffect(() => {
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
  }, [targetConnectionId]);

  useEffect(() => {
    if (!sourceConnectionId) {
      setSourceDatabases([]);
      setSourceDatabase("");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/copy/databases?connectionId=${sourceConnectionId}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as string[] | { error: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Failed to load databases.",
          );
        }

        const nextDatabases = payload as string[];
        setSourceDatabases(nextDatabases);
        setSourceDatabase((current) =>
          nextDatabases.includes(current) ? current : (nextDatabases[0] ?? ""),
        );
      } catch (databaseError) {
        setError(
          databaseError instanceof Error
            ? databaseError.message
            : "Failed to load databases.",
        );
      }
    })();
  }, [sourceConnectionId]);

  useEffect(() => {
    if (!targetConnectionId) {
      setTargetDatabases([]);
      setTargetDatabase("");
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/copy/databases?connectionId=${targetConnectionId}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as string[] | { error: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Failed to load databases.",
          );
        }

        const nextDatabases = payload as string[];
        setTargetDatabases(nextDatabases);
        setTargetDatabase((current) =>
          nextDatabases.includes(current) ? current : (nextDatabases[0] ?? ""),
        );
      } catch (databaseError) {
        setError(
          databaseError instanceof Error
            ? databaseError.message
            : "Failed to load databases.",
        );
      }
    })();
  }, [targetConnectionId]);

  useEffect(() => {
    if (!sourceConnectionId) {
      setCollections([]);
      setSourceCollections([]);
      return;
    }

    if (!sourceDatabase) {
      setCollections([]);
      setSourceCollections([]);
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/copy/collections?connectionId=${sourceConnectionId}&databaseName=${encodeURIComponent(sourceDatabase)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as string[] | { error: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Failed to load collections.",
          );
        }

        const nextCollections = payload as string[];
        setCollections(nextCollections);
        setSourceCollections((current) =>
          current.filter((collectionName) => nextCollections.includes(collectionName)),
        );
      } catch (collectionError) {
        setError(
          collectionError instanceof Error
            ? collectionError.message
            : "Failed to load collections.",
        );
      }
    })();
  }, [sourceConnectionId, sourceDatabase]);

  async function startCopyJob() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/copy/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          sourceConnectionId,
          targetConnectionId,
          sourceDatabase,
          targetDatabase,
          sourceCollections,
          mode,
          newCollectionName: mode === "new" ? newCollectionName : undefined,
        }),
      });

      const payload = (await response.json()) as CopyJob | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? (payload.error ?? "Failed to start copy job.") : "Failed to start copy job.",
        );
      }

      const nextJob = payload as CopyJob;
      setJobId(nextJob.id);
      setRecentJobs((current) => [nextJob, ...current.filter((job) => job.id !== nextJob.id)]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to start copy job.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startExportJob() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/export/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          sourceConnectionId,
          sourceDatabase,
          sourceCollections: sourceCollections.length > 0 ? sourceCollections : undefined,
        }),
      });

      const payload = (await response.json()) as CopyJob | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Failed to start export job." : "Failed to start export job.");
      }

      const nextJob = payload as CopyJob;
      setJobId(nextJob.id);
      setRecentJobs((current) => [nextJob, ...current.filter((job) => job.id !== nextJob.id)]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to start export job.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresLockedTargetConfirmation) {
      setShowLockedTargetModal(true);
      return;
    }

    if (action === "export") {
      await startExportJob();
      return;
    }

    await startCopyJob();
  }

  async function cancelJob(targetJobId: string) {
    setError("");
    setIsCancellingJobId(targetJobId);

    try {
      const response = await fetch(`/api/copy/jobs/${targetJobId}`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as CopyJob | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Failed to cancel job." : "Failed to cancel job.");
      }

      const updatedJob = payload as CopyJob;
      setRecentJobs((current) => [updatedJob, ...current.filter((job) => job.id !== updatedJob.id)]);

      if (jobId === targetJobId) {
        setJobId(updatedJob.id);
      }
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel job.");
    } finally {
      setIsCancellingJobId(null);
    }
  }

  return (
    <div
      className={
        action === "copy"
          ? "grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
          : "grid gap-6"
      }
    >
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">
          {action === "copy" ? "Collection Copy" : "Database Export"}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          {action === "copy"
            ? "Choose a source and target connection inside the same organization, then execute a streamed copy job."
            : "Export one collection, several collections, or an entire database as a ZIP of JSON files."}
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <SearchableDropdown
            label="Action"
            value={action}
            options={actionOptions}
            placeholder="Select an action"
            onChange={(value) => setAction(value as ToolAction)}
          />

          <OrganizationSelector
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onChange={setSelectedOrganizationId}
          />

          <SearchableDropdown
            label="Source connection"
            value={sourceConnectionId}
            options={connectionOptions}
            placeholder="Select source connection"
            onChange={setSourceConnectionId}
          />

          {action === "copy" ? (
            <SearchableDropdown
              label="Target connection"
              value={targetConnectionId}
              options={connectionOptions}
              placeholder="Select target connection"
              onChange={setTargetConnectionId}
            />
          ) : null}

          <SearchableDropdown
            label="Source database"
            value={sourceDatabase}
            options={sourceDatabaseOptions}
            placeholder="Select source database"
            onChange={setSourceDatabase}
            disabled={!sourceConnectionId}
          />

          {action === "copy" ? (
            <SearchableDropdown
              label="Target database"
              value={targetDatabase}
              options={targetDatabaseOptions}
              placeholder="Select target database"
              onChange={setTargetDatabase}
              disabled={!targetConnectionId}
            />
          ) : null}

          <MultiSearchableDropdown
            label="Source collections"
            values={sourceCollections}
            options={collectionOptions}
            placeholder={
              action === "copy"
                ? "Select one or more collections"
                : "Leave empty to export the entire database"
            }
            onChange={setSourceCollections}
            disabled={!sourceDatabase}
          />

          {collections.length > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSourceCollections(collections)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Select all collections
              </button>
              <button
                type="button"
                onClick={() => setSourceCollections([])}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Clear selection
              </button>
            </div>
          ) : null}

          {action === "copy" ? (
            <SearchableDropdown
              label="Copy mode"
              value={mode}
              options={modeOptions}
              placeholder="Select copy mode"
              onChange={(value) => setMode(value as CopyMode)}
            />
          ) : null}

          {action === "copy" && mode === "new" ? (
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              New collection name
              <input
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2"
                required
              />
            </label>
          ) : null}

          {action === "copy" && mode === "new" && sourceCollections.length > 1 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              `Copy to new collection` supports exactly one source collection.
            </p>
          ) : null}

          {action === "export" ? (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              If no collections are selected, the export will include the entire
              source database as one ZIP file with one JSON file per collection.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {action === "copy" && selectedTargetConnection?.locked ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Locked target selected: you must confirm the connection name before
              running this copy job.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !selectedOrganizationId ||
              !sourceConnectionId ||
              !sourceDatabase ||
              (action === "copy" &&
                (!targetConnectionId ||
                  !targetDatabase ||
                  sourceCollections.length === 0 ||
                  (mode === "new" && sourceCollections.length !== 1)))
            }
            className={
              action === "copy"
                ? "rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                : "rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            }
          >
            {isSubmitting
              ? action === "copy"
                ? "Starting..."
                : "Preparing export..."
              : action === "copy"
                ? "Execute copy"
                : "Export ZIP"}
          </button>
        </form>
      </section>

      <ProgressPanel
        job={job}
        error={jobError}
        onCancel={cancelJob}
        isCancelling={isCancellingJobId === job?.id}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm xl:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-950">Recent Jobs</h3>
          <span className="text-sm text-zinc-500">{recentJobs.length} jobs</span>
        </div>
        {recentJobs.length === 0 ? (
          <p className="text-sm text-zinc-500">No persisted jobs yet.</p>
        ) : (
          <div className="grid gap-3">
            {recentJobs.map((recentJob) => (
              <div
                key={recentJob.id}
                className="rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setJobId(recentJob.id);

                      if (
                        recentJob.kind === "export" &&
                        recentJob.status === "completed" &&
                        recentJob.resultAvailable
                      ) {
                        window.open(`/api/export/jobs/${recentJob.id}/download`, "_blank");
                      }
                    }}
                    className="flex-1 text-left"
                  >
                    <p className="font-medium text-zinc-950">
                      {recentJob.kind === "export"
                        ? `${recentJob.sourceDatabase}.${recentJob.sourceCollection} to ${recentJob.artifactFileName ?? "ZIP artifact"}`
                        : `${recentJob.sourceDatabase}.${recentJob.sourceCollection} to ${recentJob.targetDatabase}.${recentJob.targetCollection}`}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Started {new Date(recentJob.startedAt).toLocaleString()}
                    </p>
                    {recentJob.cancelRequestedAt && recentJob.status !== "cancelled" ? (
                      <p className="mt-1 text-xs text-amber-700">Cancellation requested.</p>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-2">
                    {(recentJob.status === "queued" || recentJob.status === "running") ? (
                      <button
                        type="button"
                        onClick={() => {
                          void cancelJob(recentJob.id);
                        }}
                        disabled={Boolean(recentJob.cancelRequestedAt) || isCancellingJobId === recentJob.id}
                        className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {recentJob.cancelRequestedAt || isCancellingJobId === recentJob.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    ) : null}
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                      {recentJob.kind}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      {recentJob.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        title="Confirm locked target"
        description={
          selectedTargetConnection
            ? `Type "${selectedTargetConnection.name}" to confirm you want to use this locked connection as the target.`
            : "Confirm the locked target connection."
        }
        isOpen={showLockedTargetModal}
        onClose={() => {
          setShowLockedTargetModal(false);
          setLockedTargetConfirmation("");
        }}
      >
        <div className="grid gap-4">
          <input
            value={lockedTargetConfirmation}
            onChange={(event) => setLockedTargetConfirmation(event.target.value)}
            placeholder="Type the connection name exactly"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />

          {action === "copy" && mode === "override" && selectedTargetConnection?.locked ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Override is still blocked for locked targets by the server-side safety
              rule.
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLockedTargetModal(false);
                setLockedTargetConfirmation("");
              }}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                isSubmitting ||
                lockedTargetConfirmation !== (selectedTargetConnection?.name ?? "")
              }
              onClick={async () => {
                setShowLockedTargetModal(false);
                await startCopyJob();
                setLockedTargetConfirmation("");
              }}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm target
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
