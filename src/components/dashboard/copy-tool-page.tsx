"use client";

import { useEffect, useMemo, useState } from "react";

import { ProgressPanel } from "@/src/components/copy/progress-panel";
import { OrganizationSelector } from "@/src/components/orgs/organization-selector";
import { Modal } from "@/src/components/shared/modal";
import { Button } from "@/src/components/ui/button";
import { Alert, Badge, EmptyState, StatusBadge } from "@/src/components/ui/feedback";
import { Field, Input } from "@/src/components/ui/field";
import {
  IconArchive,
  IconArrowRight,
  IconClock,
  IconDatabase,
  IconDownload,
  IconLayers,
  IconLock,
  IconRefresh,
  IconX,
} from "@/src/components/ui/icons";
import { Card, ChoiceCards, PageHeader, Segmented } from "@/src/components/ui/layout";
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
  const [showProdTargetModal, setShowProdTargetModal] = useState(false);
  const [prodTargetConfirmation, setProdTargetConfirmation] = useState("");
  const [showForceUnlockModal, setShowForceUnlockModal] = useState(false);
  const [forceUnlockConfirmation, setForceUnlockConfirmation] = useState("");
  const [targetLockLabel, setTargetLockLabel] = useState<string | null>(null);
  const [mongodumpAvailable, setMongodumpAvailable] = useState(false);
  const [useMongodump, setUseMongodump] = useState(false);
  const [isResumingJobId, setIsResumingJobId] = useState<string | null>(null);
  const [isRevertingJobId, setIsRevertingJobId] = useState<string | null>(null);
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
    label: `${connection.name} [${connection.environment ?? "local"}]${connection.locked ? " (Locked)" : ""}`,
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
  const selectedSourceConnection =
    filteredConnections.find((connection) => connection.id === sourceConnectionId) ?? null;
  const selectedTargetConnection =
    filteredConnections.find((connection) => connection.id === targetConnectionId) ?? null;
  const requiresLockedTargetConfirmation =
    action === "copy" && Boolean(selectedTargetConnection?.locked);
  const requiresProdTargetConfirmation =
    action === "copy" && selectedTargetConnection?.environment === "prod";

  useEffect(() => {
    void (async () => {
      try {
        const mongodumpResponse = await fetch("/api/export/mongodump", { cache: "no-store" });
        if (mongodumpResponse.ok) {
          const payload = (await mongodumpResponse.json()) as { available?: boolean };
          setMongodumpAvailable(Boolean(payload.available));
        }
      } catch {
        setMongodumpAvailable(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (action !== "copy" || !targetConnectionId || !targetDatabase) {
      setTargetLockLabel(null);
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/copy/locks?connectionId=${targetConnectionId}&database=${encodeURIComponent(targetDatabase)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          setTargetLockLabel(null);
          return;
        }
        const payload = (await response.json()) as {
          jobId?: string;
          owner?: string;
          startedAt?: string;
        } | null;
        if (!payload?.jobId) {
          setTargetLockLabel(null);
          return;
        }
        const ageSec = payload.startedAt
          ? Math.round((Date.now() - new Date(payload.startedAt).getTime()) / 1000)
          : 0;
        setTargetLockLabel(
          `Locked by job ${payload.jobId.slice(0, 8)}… (${payload.owner ?? "unknown"}, ${ageSec}s)`,
        );
      } catch {
        setTargetLockLabel(null);
      }
    })();
  }, [action, targetConnectionId, targetDatabase, job?.status]);

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
          useMongodump: useMongodump || undefined,
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

    if (action === "export") {
      await startExportJob();
      return;
    }

    if (requiresProdTargetConfirmation) {
      setShowProdTargetModal(true);
      return;
    }

    if (requiresLockedTargetConfirmation) {
      setShowLockedTargetModal(true);
      return;
    }

    await startCopyJob();
  }

  async function resumeJob(targetJobId: string) {
    setError("");
    setIsResumingJobId(targetJobId);
    try {
      const response = await fetch(`/api/copy/jobs/${targetJobId}/resume`, { method: "POST" });
      const payload = (await response.json()) as CopyJob | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error ?? "Failed to resume job." : "Failed to resume job.",
        );
      }
      const updatedJob = payload as CopyJob;
      setJobId(updatedJob.id);
      setRecentJobs((current) => [updatedJob, ...current.filter((entry) => entry.id !== updatedJob.id)]);
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : "Failed to resume job.");
    } finally {
      setIsResumingJobId(null);
    }
  }

  async function revertJob(targetJobId: string) {
    setError("");
    setIsRevertingJobId(targetJobId);
    try {
      const response = await fetch(`/api/copy/jobs/${targetJobId}/revert`, { method: "POST" });
      const payload = (await response.json()) as CopyJob | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error ?? "Failed to revert job." : "Failed to revert job.",
        );
      }
      const updatedJob = payload as CopyJob;
      setJobId(updatedJob.id);
      setRecentJobs((current) => [updatedJob, ...current.filter((entry) => entry.id !== updatedJob.id)]);
    } catch (revertError) {
      setError(revertError instanceof Error ? revertError.message : "Failed to revert job.");
    } finally {
      setIsRevertingJobId(null);
    }
  }

  async function forceUnlockTarget() {
    if (!targetConnectionId || !targetDatabase) {
      return;
    }
    setError("");
    try {
      const response = await fetch("/api/copy/locks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: targetConnectionId,
          database: targetDatabase,
          confirmDatabaseName: forceUnlockConfirmation,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to force unlock.");
      }
      setTargetLockLabel(null);
      setShowForceUnlockModal(false);
      setForceUnlockConfirmation("");
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Failed to force unlock.");
    }
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

  const isCopy = action === "copy";
  const canSubmit = !(
    isSubmitting ||
    !selectedOrganizationId ||
    !sourceConnectionId ||
    !sourceDatabase ||
    (isCopy &&
      (!targetConnectionId ||
        !targetDatabase ||
        sourceCollections.length === 0 ||
        (mode === "new" && sourceCollections.length !== 1)))
  );
  const selectionSummary =
    sourceCollections.length === 0
      ? isCopy
        ? "No collections selected"
        : "Entire database"
      : `${sourceCollections.length} collection${sourceCollections.length === 1 ? "" : "s"}`;

  function closeLockedTargetModal() {
    setShowLockedTargetModal(false);
    setLockedTargetConfirmation("");
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Copy & Export"
        title={isCopy ? "Copy collections" : "Export a database"}
        description={
          isCopy
            ? "Choose a source and a target inside the same organization, then run a streamed copy job."
            : "Export one collection, several, or an entire database as a ZIP of JSON files."
        }
        actions={
          <Segmented
            ariaLabel="Action"
            value={action}
            onChange={setAction}
            options={[
              { value: "copy", label: "Copy to DB", icon: <IconRefresh size={14} /> },
              { value: "export", label: "Export ZIP", icon: <IconArchive size={14} /> },
            ]}
          />
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-7 p-6">
              <Step number={1} title="Organization">
                <OrganizationSelector
                  organizations={organizations}
                  selectedOrganizationId={selectedOrganizationId}
                  onChange={setSelectedOrganizationId}
                  hideLabel
                />
              </Step>

              <Step number={2} title={isCopy ? "Route" : "Source"}>
                <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <EndpointPanel label="Source" tone="prod">
                    <SearchableDropdown
                      label="Source connection"
                      value={sourceConnectionId}
                      options={connectionOptions}
                      placeholder="Select connection"
                      onChange={setSourceConnectionId}
                      icon={<IconDatabase />}
                    />
                    <SearchableDropdown
                      label="Source database"
                      value={sourceDatabase}
                      options={sourceDatabaseOptions}
                      placeholder="Select database"
                      onChange={setSourceDatabase}
                      disabled={!sourceConnectionId}
                      icon={<IconLayers />}
                    />
                  </EndpointPanel>

                  <div className="flex items-center justify-center">
                    <span className="flex size-9 rotate-90 items-center justify-center rounded-full border border-line bg-surface text-sync shadow-card md:rotate-0">
                      <IconArrowRight />
                    </span>
                  </div>

                  {isCopy ? (
                    <EndpointPanel label="Target" tone="copy" locked={selectedTargetConnection?.locked}>
                      <SearchableDropdown
                        label="Target connection"
                        value={targetConnectionId}
                        options={connectionOptions}
                        placeholder="Select connection"
                        onChange={setTargetConnectionId}
                        icon={<IconDatabase />}
                      />
                      <SearchableDropdown
                        label="Target database"
                        value={targetDatabase}
                        options={targetDatabaseOptions}
                        placeholder="Select database"
                        onChange={setTargetDatabase}
                        disabled={!targetConnectionId}
                        icon={<IconLayers />}
                      />
                    </EndpointPanel>
                  ) : (
                    <div className="flex flex-col justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper/60 p-4">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-sync-glow">
                        <IconArchive size={18} />
                      </span>
                      <div>
                        <p className="font-display text-[15px] font-semibold">ZIP archive</p>
                        <p className="mt-0.5 text-[13px] leading-5 text-muted">
                          One JSON file per collection, downloadable when the job finishes.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Step>

              <Step
                number={3}
                title="Collections"
                aside={
                  collections.length > 0 ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSourceCollections(collections)}
                      >
                        Select all
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSourceCollections([])}
                        disabled={sourceCollections.length === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : null
                }
              >
                <MultiSearchableDropdown
                  label="Source collections"
                  values={sourceCollections}
                  options={collectionOptions}
                  placeholder={
                    isCopy
                      ? "Select one or more collections"
                      : "Leave empty to export the entire database"
                  }
                  onChange={setSourceCollections}
                  disabled={!sourceDatabase}
                  icon={<IconLayers />}
                />
                {sourceCollections.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sourceCollections.slice(0, 12).map((collectionName) => (
                      <button
                        key={collectionName}
                        type="button"
                        onClick={() =>
                          setSourceCollections((current) =>
                            current.filter((value) => value !== collectionName),
                          )
                        }
                        className="group inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-paper pl-2.5 pr-1.5 font-mono text-xs text-ink transition hover:border-line-strong"
                        title={`Remove ${collectionName}`}
                      >
                        {collectionName}
                        <IconX size={12} className="text-subtle group-hover:text-ink" />
                      </button>
                    ))}
                    {sourceCollections.length > 12 ? (
                      <span className="inline-flex h-7 items-center px-1.5 text-xs text-muted">
                        +{sourceCollections.length - 12} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Step>

              {isCopy ? (
                <Step number={4} title="Copy mode">
                  <ChoiceCards
                    ariaLabel="Copy mode"
                    value={mode}
                    onChange={setMode}
                    options={[
                      {
                        value: "override",
                        label: "Replace",
                        description: "Stage, verify, then swap. Previous data kept as a backup.",
                      },
                      {
                        value: "append",
                        label: "Append",
                        description: "Insert into the target; revert can remove this job's docs.",
                      },
                      {
                        value: "new",
                        label: "New collection",
                        description: "Copy one collection under a new name.",
                      },
                    ]}
                  />
                  {mode === "new" ? (
                    <Field label="New collection name" className="mt-4">
                      <Input
                        value={newCollectionName}
                        onChange={(event) => setNewCollectionName(event.target.value)}
                        className="font-mono text-[13px]"
                        placeholder="orders_backup"
                        required
                      />
                    </Field>
                  ) : null}
                </Step>
              ) : null}

              {(isCopy && mode === "new" && sourceCollections.length > 1) ||
              !isCopy ||
              (isCopy && selectedTargetConnection?.locked) ||
              (isCopy && selectedTargetConnection?.environment === "prod") ||
              targetLockLabel ||
              error ? (
                <div className="grid gap-2">
                  {isCopy && mode === "new" && sourceCollections.length > 1 ? (
                    <Alert tone="warning">
                      &ldquo;New collection&rdquo; mode supports exactly one source collection.
                    </Alert>
                  ) : null}
                  {!isCopy ? (
                    <Alert tone="info">
                      With no collections selected, the export streams the entire source
                      database as NDJSON inside a ZIP (plus indexes metadata).
                    </Alert>
                  ) : null}
                  {!isCopy && mongodumpAvailable ? (
                    <label className="flex items-center gap-2 text-[13px] text-ink">
                      <input
                        type="checkbox"
                        checked={useMongodump}
                        onChange={(event) => setUseMongodump(event.target.checked)}
                      />
                      Use mongodump (detected on PATH)
                    </label>
                  ) : null}
                  {isCopy && selectedTargetConnection?.locked ? (
                    <Alert tone="warning" title="Locked target selected">
                      You&apos;ll need to type the connection name to confirm before this copy
                      runs.
                    </Alert>
                  ) : null}
                  {isCopy && selectedTargetConnection?.environment === "prod" ? (
                    <Alert tone="danger" title="Production target">
                      Copying into a prod-tagged connection requires typing the database name
                      to confirm.
                    </Alert>
                  ) : null}
                  {targetLockLabel ? (
                    <Alert tone="warning" title="Target database job lock">
                      {targetLockLabel}. Readers still see old data until swap finishes.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setShowForceUnlockModal(true)}
                      >
                        Force unlock
                      </button>
                    </Alert>
                  ) : null}
                  {error ? <Alert tone="danger">{error}</Alert> : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-b-[var(--radius-card)] border-t border-line bg-paper/60 px-6 py-4">
              <p className="text-[13px] text-muted">
                {isCopy && selectedSourceConnection && selectedTargetConnection ? (
                  <span className="font-medium text-ink">
                    {selectedSourceConnection.name} ({selectedSourceConnection.environment ?? "local"})
                    {" → "}
                    {selectedTargetConnection.name} ({selectedTargetConnection.environment ?? "local"})
                  </span>
                ) : (
                  <span className="font-medium text-ink">{selectionSummary}</span>
                )}
                {isCopy ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="capitalize">
                      {mode === "new" ? "new collection" : mode === "override" ? "replace" : mode}
                    </span>{" "}
                    · {selectionSummary}
                    {mode === "override" ? " · a backup will be kept" : ""}
                  </>
                ) : (
                  " · ZIP export"
                )}
              </p>
              <Button
                type="submit"
                variant="accent"
                size="lg"
                loading={isSubmitting}
                disabled={!canSubmit}
                icon={isCopy ? <IconRefresh size={16} /> : <IconDownload size={16} />}
              >
                {isSubmitting
                  ? isCopy
                    ? "Starting..."
                    : "Preparing export..."
                  : isCopy
                    ? "Run copy"
                    : "Export ZIP"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="xl:sticky xl:top-10">
          <ProgressPanel
            job={job}
            error={jobError}
            onCancel={cancelJob}
            onResume={resumeJob}
            onRevert={revertJob}
            isCancelling={isCancellingJobId === job?.id}
            isResuming={isResumingJobId === job?.id}
            isReverting={isRevertingJobId === job?.id}
          />
        </div>
      </div>

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Recent jobs</h2>
          <Badge>{recentJobs.length} jobs</Badge>
        </div>
        {recentJobs.length === 0 ? (
          <EmptyState icon={<IconClock size={20} />} title="No jobs yet">
            Jobs you run are saved here for 10 days, along with their logs.
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {recentJobs.map((recentJob) => {
                const isActive = recentJob.id === job?.id;
                const isRunning =
                  recentJob.status === "queued" ||
                  recentJob.status === "running" ||
                  recentJob.status === "verifying" ||
                  recentJob.status === "swapping";
                return (
                  <li
                    key={recentJob.id}
                    className={
                      isActive
                        ? "relative flex items-center gap-4 bg-sync-wash/50 px-5 py-3.5"
                        : "relative flex items-center gap-4 px-5 py-3.5 transition hover:bg-paper"
                    }
                  >
                    {isActive ? (
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-sync" />
                    ) : null}
                    <span
                      className={
                        recentJob.kind === "export"
                          ? "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-sync-glow"
                          : "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sync-wash text-sync"
                      }
                    >
                      {recentJob.kind === "export" ? (
                        <IconArchive size={16} />
                      ) : (
                        <IconRefresh size={16} />
                      )}
                    </span>
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
                      className="min-w-0 flex-1 text-left after:absolute after:inset-0"
                    >
                      <p className="flex min-w-0 items-center gap-2 font-mono text-[13px] text-ink">
                        <span className="truncate">
                          {recentJob.sourceDatabase}.{recentJob.sourceCollection}
                        </span>
                        <IconArrowRight size={13} className="shrink-0 text-subtle" />
                        <span className="truncate">
                          {recentJob.kind === "export"
                            ? (recentJob.artifactFileName ?? "ZIP artifact")
                            : `${recentJob.targetDatabase}.${recentJob.targetCollection}`}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {new Date(recentJob.startedAt).toLocaleString()}
                        {recentJob.cancelRequestedAt && recentJob.status !== "cancelled" ? (
                          <span className="text-amber-700"> · Cancellation requested</span>
                        ) : null}
                      </p>
                    </button>
                    <div className="relative z-10 flex shrink-0 items-center gap-2">
                      {isRunning ? (
                        <Button
                          size="sm"
                          variant="danger-soft"
                          onClick={() => {
                            void cancelJob(recentJob.id);
                          }}
                          disabled={
                            Boolean(recentJob.cancelRequestedAt) ||
                            isCancellingJobId === recentJob.id
                          }
                        >
                          {recentJob.cancelRequestedAt || isCancellingJobId === recentJob.id
                            ? "Cancelling..."
                            : "Cancel"}
                        </Button>
                      ) : null}
                      {recentJob.status === "paused" ? (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => {
                            void resumeJob(recentJob.id);
                          }}
                          disabled={isResumingJobId === recentJob.id}
                        >
                          {isResumingJobId === recentJob.id ? "Resuming..." : "Resume"}
                        </Button>
                      ) : null}
                      {recentJob.status === "completed" &&
                      (recentJob.kind === "copy" || recentJob.kind === "import") ? (
                        <Button
                          size="sm"
                          variant="danger-soft"
                          onClick={() => {
                            void revertJob(recentJob.id);
                          }}
                          disabled={isRevertingJobId === recentJob.id}
                        >
                          {isRevertingJobId === recentJob.id ? "Reverting..." : "Revert"}
                        </Button>
                      ) : null}
                      <Badge className="hidden capitalize sm:inline-flex">{recentJob.kind}</Badge>
                      <StatusBadge status={recentJob.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <Modal
        title="Confirm production target"
        description={
          targetDatabase
            ? `Type "${targetDatabase}" to confirm copying into a production-tagged connection.`
            : "Confirm the production target database."
        }
        isOpen={showProdTargetModal}
        onClose={() => {
          setShowProdTargetModal(false);
          setProdTargetConfirmation("");
        }}
        icon={<IconLock size={17} />}
        tone="warning"
      >
        <div className="grid gap-4">
          <Input
            value={prodTargetConfirmation}
            onChange={(event) => setProdTargetConfirmation(event.target.value)}
            placeholder="Type the database name exactly"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowProdTargetModal(false);
                setProdTargetConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || prodTargetConfirmation !== targetDatabase}
              onClick={async () => {
                setShowProdTargetModal(false);
                setProdTargetConfirmation("");
                if (requiresLockedTargetConfirmation) {
                  setShowLockedTargetModal(true);
                  return;
                }
                await startCopyJob();
              }}
              variant="warning"
            >
              Confirm production target
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Force unlock target"
        description={
          targetDatabase
            ? `Type "${targetDatabase}" to remove a stale MongoSync job lock.`
            : "Confirm force unlock."
        }
        isOpen={showForceUnlockModal}
        onClose={() => {
          setShowForceUnlockModal(false);
          setForceUnlockConfirmation("");
        }}
        icon={<IconLock size={17} />}
        tone="warning"
      >
        <div className="grid gap-4">
          <Alert tone="warning">
            Only force unlock if you are sure no other MongoSync job is still writing.
          </Alert>
          <Input
            value={forceUnlockConfirmation}
            onChange={(event) => setForceUnlockConfirmation(event.target.value)}
            placeholder="Type the database name exactly"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setShowForceUnlockModal(false);
                setForceUnlockConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={forceUnlockConfirmation !== targetDatabase}
              onClick={() => {
                void forceUnlockTarget();
              }}
              variant="warning"
            >
              Force unlock
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Confirm locked target"
        description={
          selectedTargetConnection
            ? `Type "${selectedTargetConnection.name}" to confirm you want to use this locked connection as the target.`
            : "Confirm the locked target connection."
        }
        isOpen={showLockedTargetModal}
        onClose={closeLockedTargetModal}
        icon={<IconLock size={17} />}
        tone="warning"
      >
        <div className="grid gap-4">
          <Input
            value={lockedTargetConfirmation}
            onChange={(event) => setLockedTargetConfirmation(event.target.value)}
            placeholder="Type the connection name exactly"
            autoFocus
          />

          {isCopy && mode === "override" && selectedTargetConnection?.locked ? (
            <Alert tone="danger">
              Override is still blocked for locked targets by the server-side safety rule.
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button onClick={closeLockedTargetModal}>Cancel</Button>
            <Button
              disabled={
                isSubmitting ||
                lockedTargetConfirmation !== (selectedTargetConnection?.name ?? "")
              }
              onClick={async () => {
                setShowLockedTargetModal(false);
                await startCopyJob();
                setLockedTargetConfirmation("");
              }}
              variant="warning"
            >
              Confirm target
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Step({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <legend className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-ink font-display text-[11px] font-semibold text-paper">
            {number}
          </span>
          <span className="font-display text-[15px] font-semibold text-ink">{title}</span>
        </legend>
        {aside}
      </div>
      <div>{children}</div>
    </fieldset>
  );
}

function EndpointPanel({
  label,
  tone,
  locked,
  children,
}: {
  label: string;
  tone: "prod" | "copy";
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-3 rounded-2xl border border-line bg-paper/60 p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-display text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          <span className={tone === "prod" ? "size-2 rounded-full bg-ink" : "size-2 rounded-full bg-sync"} />
          {label}
        </span>
        {locked ? (
          <Badge tone="amber" icon={<IconLock size={11} />}>
            Locked
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  );
}
