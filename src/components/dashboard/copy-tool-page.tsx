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
import { readApiResponse } from "@/src/utils/api-client";

type ToolAction = "copy" | "export";
type WizardStep = 1 | 2 | 3;

export function CopyToolPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [recentJobs, setRecentJobs] = useState<CopyJob[]>([]);
  const [sourceDatabases, setSourceDatabases] = useState<string[]>([]);
  const [targetDatabases, setTargetDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [isLoadingSourceDatabases, setIsLoadingSourceDatabases] = useState(false);
  const [isLoadingTargetDatabases, setIsLoadingTargetDatabases] = useState(false);
  const [sourceConnectionId, setSourceConnectionId] = useState("");
  const [targetConnectionId, setTargetConnectionId] = useState("");
  const [sourceDatabase, setSourceDatabase] = useState("");
  const [targetDatabase, setTargetDatabase] = useState("");
  const [useNewTargetDatabase, setUseNewTargetDatabase] = useState(false);
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
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
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
  const selectedSourceConnection =
    filteredConnections.find((connection) => connection.id === sourceConnectionId) ?? null;
  const requiresLockedTargetConfirmation =
    action === "copy" && Boolean(selectedTargetConnection?.locked);
  const normalizedTargetDatabase = targetDatabase.trim();
  const canProceedFromStep1 =
    Boolean(selectedOrganizationId) &&
    Boolean(sourceConnectionId) &&
    (action === "export" || Boolean(targetConnectionId));
  const canProceedFromStep2 =
    Boolean(sourceDatabase) &&
    (action === "export" || Boolean(normalizedTargetDatabase)) &&
    (action === "export" || sourceCollections.length > 0);
  const canSubmit =
    !isSubmitting &&
    Boolean(selectedOrganizationId) &&
    Boolean(sourceConnectionId) &&
    Boolean(sourceDatabase) &&
    (action === "export" ||
      (Boolean(targetConnectionId) &&
        Boolean(normalizedTargetDatabase) &&
        sourceCollections.length > 0 &&
        (mode !== "new" || sourceCollections.length === 1)));
  const stepLabels =
    action === "copy"
      ? ["Connections", "Source & target", "Copy options"]
      : ["Connection", "Source data", "Review export"];

  useEffect(() => {
    void (async () => {
      try {
        const [organizationsResponse, connectionsResponse] = await Promise.all([
          fetch("/api/organizations", { cache: "no-store" }),
          fetch("/api/connections", { cache: "no-store" }),
        ]);

        const organizationsPayload = await readApiResponse<Organization[]>(
          organizationsResponse,
          "Failed to load organizations.",
        );
        const connectionsPayload = await readApiResponse<Connection[]>(
          connectionsResponse,
          "Failed to load connections.",
        );

        setOrganizations(organizationsPayload);
        setConnections(connectionsPayload);
        const jobsResponse = await fetch("/api/copy/jobs", { cache: "no-store" });
        const jobsPayload = await readApiResponse<CopyJob[]>(
          jobsResponse,
          "Failed to load jobs.",
        );

        if (jobsResponse.ok) {
          setRecentJobs(jobsPayload);
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
    setUseNewTargetDatabase(false);
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
  }, [selectedOrganizationId]);

  useEffect(() => {
    setError("");
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
    setCurrentStep(1);
  }, [action]);

  useEffect(() => {
    setLockedTargetConfirmation("");
    setShowLockedTargetModal(false);
    setUseNewTargetDatabase(false);
  }, [targetConnectionId]);

  useEffect(() => {
    if (currentStep > 1 && !canProceedFromStep1) {
      setCurrentStep(1);
      return;
    }

    if (currentStep > 2 && !canProceedFromStep2) {
      setCurrentStep(2);
    }
  }, [canProceedFromStep1, canProceedFromStep2, currentStep]);

  useEffect(() => {
    if (!sourceConnectionId) {
      setIsLoadingSourceDatabases(false);
      setSourceDatabases([]);
      setSourceDatabase("");
      return;
    }

    void (async () => {
      setIsLoadingSourceDatabases(true);
      try {
        const response = await fetch(
          `/api/copy/databases?connectionId=${sourceConnectionId}`,
          { cache: "no-store" },
        );
        const nextDatabases = await readApiResponse<string[]>(
          response,
          "Failed to load databases.",
        );
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
      } finally {
        setIsLoadingSourceDatabases(false);
      }
    })();
  }, [sourceConnectionId]);

  useEffect(() => {
    if (!targetConnectionId) {
      setIsLoadingTargetDatabases(false);
      setTargetDatabases([]);
      setTargetDatabase("");
      return;
    }

    void (async () => {
      setIsLoadingTargetDatabases(true);
      try {
        const response = await fetch(
          `/api/copy/databases?connectionId=${targetConnectionId}`,
          { cache: "no-store" },
        );
        const nextDatabases = await readApiResponse<string[]>(
          response,
          "Failed to load databases.",
        );
        setTargetDatabases(nextDatabases);
        setTargetDatabase((current) => {
          if (useNewTargetDatabase) {
            return current;
          }

          return nextDatabases.includes(current) ? current : (nextDatabases[0] ?? "");
        });
      } catch (databaseError) {
        setError(
          databaseError instanceof Error
            ? databaseError.message
            : "Failed to load databases.",
        );
      } finally {
        setIsLoadingTargetDatabases(false);
      }
    })();
  }, [targetConnectionId, useNewTargetDatabase]);

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
        const nextCollections = await readApiResponse<string[]>(
          response,
          "Failed to load collections.",
        );
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
          targetDatabase: normalizedTargetDatabase,
          sourceCollections,
          mode,
          newCollectionName: mode === "new" ? newCollectionName : undefined,
        }),
      });

      const nextJob = await readApiResponse<CopyJob>(
        response,
        "Failed to start copy job.",
      );
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

      const nextJob = await readApiResponse<CopyJob>(
        response,
        "Failed to start export job.",
      );
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

  async function executeCurrentAction() {
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
      const updatedJob = await readApiResponse<CopyJob>(
        response,
        "Failed to cancel job.",
      );
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

  function goToStep(step: WizardStep) {
    if (step === currentStep) {
      return;
    }

    if (step === 1) {
      setCurrentStep(1);
      return;
    }

    if (step === 2 && canProceedFromStep1) {
      setCurrentStep(2);
      return;
    }

    if (step === 3 && canProceedFromStep1 && canProceedFromStep2) {
      setCurrentStep(3);
    }
  }

  function renderStepBadge(step: WizardStep, label: string) {
    const isActive = currentStep === step;
    const isDone = currentStep > step;
    const isClickable =
      step === 1 || (step === 2 && canProceedFromStep1) || (step === 3 && canProceedFromStep2);

    return (
      <button
        key={step}
        type="button"
        onClick={() => goToStep(step)}
        disabled={!isClickable}
        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm text-left transition ${
          isActive
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : isDone
              ? "border-zinc-300 bg-zinc-50 text-zinc-700"
              : "border-zinc-200 bg-white text-zinc-500"
        } ${isClickable ? "cursor-pointer hover:border-zinc-400" : "cursor-not-allowed opacity-60"}`}
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
            isActive
              ? "bg-emerald-600 text-white"
              : isDone
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {step}
        </span>
        <span className="font-medium">{label}</span>
      </button>
    );
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

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {stepLabels.map((label, index) =>
            renderStepBadge((index + 1) as WizardStep, label),
          )}
        </div>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          {currentStep === 1 ? (
            <>
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
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <SearchableDropdown
                label="Source database"
                value={sourceDatabase}
                options={sourceDatabaseOptions}
                placeholder={
                  isLoadingSourceDatabases
                    ? "Loading source databases..."
                    : "Select source database"
                }
                onChange={setSourceDatabase}
                disabled={!sourceConnectionId}
              />
              {isLoadingSourceDatabases ? (
                <p className="text-sm text-zinc-500">
                  Loading source databases from `{selectedSourceConnection?.name ?? "selected connection"}`...
                </p>
              ) : null}

              {action === "copy" ? (
                <>
                  <label className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={useNewTargetDatabase}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setUseNewTargetDatabase(checked);

                        if (!checked) {
                          setTargetDatabase((current) =>
                            targetDatabases.includes(current) ? current : (targetDatabases[0] ?? ""),
                          );
                        } else {
                          setTargetDatabase("");
                        }
                      }}
                      disabled={!targetConnectionId}
                    />
                    <span>Use a new target database name instead of selecting an existing one</span>
                  </label>

                  {useNewTargetDatabase ? (
                    <label className="grid gap-2 text-sm font-medium text-zinc-700">
                      New target database name
                      <input
                        value={targetDatabase}
                        onChange={(event) => setTargetDatabase(event.target.value)}
                        placeholder="Enter new target database name"
                        className="rounded-md border border-zinc-300 px-3 py-2"
                        disabled={!targetConnectionId}
                      />
                    </label>
                  ) : (
                    <SearchableDropdown
                      label="Target database"
                      value={targetDatabase}
                      options={targetDatabaseOptions}
                      placeholder={
                        isLoadingTargetDatabases
                          ? "Loading target databases..."
                          : "Select target database"
                      }
                      onChange={setTargetDatabase}
                      disabled={!targetConnectionId}
                    />
                  )}
                  {isLoadingTargetDatabases ? (
                    <p className="text-sm text-zinc-500">
                      Loading target databases from `{selectedTargetConnection?.name ?? "selected connection"}`...
                    </p>
                  ) : null}
                  {!useNewTargetDatabase && !isLoadingTargetDatabases && targetDatabases.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No databases were found on the target connection. Turn on the checkbox above to type a new database name.
                    </p>
                  ) : null}
                </>
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

              {action === "export" ? (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  If no collections are selected, the export will include the entire
                  source database as one ZIP file with one JSON file per collection.
                </p>
              ) : null}
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              {action === "copy" ? (
                <>
                  <SearchableDropdown
                    label="Copy mode"
                    value={mode}
                    options={modeOptions}
                    placeholder="Select copy mode"
                    onChange={(value) => setMode(value as CopyMode)}
                  />

                  {mode === "new" ? (
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

                  {mode === "new" && sourceCollections.length > 1 ? (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      `Copy to new collection` supports exactly one source collection.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Review the selected source below, then start the export when ready.
                </p>
              )}

              <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Organization
                  </span>
                  <span>
                    {organizations.find((organization) => organization.id === selectedOrganizationId)
                      ?.name ?? "Not selected"}
                  </span>
                </div>
                <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                  <div className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Source
                    </span>
                    <span>{selectedSourceConnection?.name ?? "Not selected"}</span>
                    <span className="text-zinc-500">{sourceDatabase || "No database selected"}</span>
                  </div>
                  {action === "copy" ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Target
                      </span>
                      <span>{selectedTargetConnection?.name ?? "Not selected"}</span>
                      <span className="text-zinc-500">
                        {normalizedTargetDatabase || "No database selected"}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Collections
                  </span>
                  <span>
                    {sourceCollections.length > 0
                      ? sourceCollections.join(", ")
                      : action === "export"
                        ? "Entire database export"
                        : "No collections selected"}
                  </span>
                </div>
              </div>
            </>
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

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep((current) => Math.max(1, current - 1) as WizardStep)}
              disabled={currentStep === 1}
              className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 disabled:opacity-50"
            >
              Back
            </button>

            <div className="flex gap-3">
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentStep((current) =>
                      Math.min(3, current + 1) as WizardStep,
                    )
                  }
                  disabled={
                    (currentStep === 1 && !canProceedFromStep1) ||
                    (currentStep === 2 && !canProceedFromStep2)
                  }
                  className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => {
                    void executeCurrentAction();
                  }}
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
              )}
            </div>
          </div>
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
