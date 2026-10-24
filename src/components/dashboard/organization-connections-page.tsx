"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectionCard } from "@/src/components/connections/connection-card";
import { OrganizationSelector } from "@/src/components/orgs/organization-selector";
import { Modal } from "@/src/components/shared/modal";
import { Button } from "@/src/components/ui/button";
import { Alert, Badge, EmptyState } from "@/src/components/ui/feedback";
import { Field, Input, Toggle } from "@/src/components/ui/field";
import {
  IconBuilding,
  IconDatabase,
  IconKey,
  IconLock,
  IconPencil,
  IconPlus,
  IconShield,
} from "@/src/components/ui/icons";
import { Card, CardHeader, PageHeader } from "@/src/components/ui/layout";
import { useSelectedOrganization } from "@/src/hooks/use-selected-organization";
import type { Connection, Organization } from "@/src/types/models";

export function OrganizationConnectionsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [mongoUrl, setMongoUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [environment, setEnvironment] = useState<"prod" | "staging" | "dev" | "local">("local");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isRenamingOrganization, setIsRenamingOrganization] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingRecovery, setIsSavingRecovery] = useState(false);
  const [isClearingRecovery, setIsClearingRecovery] = useState(false);
  const [showRenameOrganizationModal, setShowRenameOrganizationModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [existingRecoveryQuestion, setExistingRecoveryQuestion] = useState<string | null>(
    null,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [confirmRecoveryAnswer, setConfirmRecoveryAnswer] = useState("");
  const [renameOrganizationName, setRenameOrganizationName] = useState("");
  const organizationIds = useMemo(
    () => organizations.map((organization) => organization.id),
    [organizations],
  );
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useSelectedOrganization(organizationIds);
  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;

  async function loadOrganizations() {
    const response = await fetch("/api/organizations", { cache: "no-store" });
    const payload = (await response.json()) as Organization[] | { error: string };

    if (!response.ok) {
      throw new Error("error" in payload ? payload.error : "Failed to load organizations.");
    }

    setOrganizations(payload as Organization[]);
  }

  async function loadConnections(organizationId?: string) {
    const search = organizationId ? `?organizationId=${organizationId}` : "";
    const response = await fetch(`/api/connections${search}`, { cache: "no-store" });
    const payload = (await response.json()) as Connection[] | { error: string };

    if (!response.ok) {
      throw new Error("error" in payload ? payload.error : "Failed to load connections.");
    }

    setConnections(payload as Connection[]);
  }

  async function loadRecovery() {
    const response = await fetch("/api/auth/recovery", { cache: "no-store" });
    const payload = (await response.json()) as {
      hasRecovery?: boolean;
      recoveryQuestion?: string | null;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load recovery settings.");
    }

    setHasRecovery(Boolean(payload.hasRecovery));
    setExistingRecoveryQuestion(payload.recoveryQuestion ?? null);
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadOrganizations(), loadRecovery()]);
        setIsLoading(false);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) {
      setConnections([]);
      return;
    }

    void loadConnections(selectedOrganizationId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load connections.");
    });
  }, [selectedOrganizationId]);

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSavingOrganization(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: organizationName }),
      });
      const payload = (await response.json()) as Organization | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create organization.");
      }

      const createdOrganization = payload as Organization;
      setOrganizations((current) =>
        [...current, createdOrganization].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelectedOrganizationId(createdOrganization.id);
      setOrganizationName("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create organization.");
    } finally {
      setIsSavingOrganization(false);
    }
  }

  async function handleCreateConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSavingConnection(true);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connectionName,
          mongoUrl,
          locked,
          environment,
          organizationId: selectedOrganizationId,
        }),
      });
      const payload = (await response.json()) as Connection | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create connection.");
      }

      setConnections((current) =>
        [...current, payload as Connection].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setConnectionName("");
      setMongoUrl("");
      setLocked(false);
      setEnvironment("local");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create connection.");
    } finally {
      setIsSavingConnection(false);
    }
  }

  async function handleRenameOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrganization) {
      setError("Select an organization first.");
      return;
    }

    setError("");
    setIsRenamingOrganization(true);

    try {
      const response = await fetch(`/api/organizations/${selectedOrganization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameOrganizationName }),
      });
      const payload = (await response.json()) as Organization | { error: string };

      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "Failed to rename organization.",
        );
      }

      const renamedOrganization = payload as Organization;
      setOrganizations((current) =>
        current
          .map((organization) =>
            organization.id === renamedOrganization.id ? renamedOrganization : organization,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setShowRenameOrganizationModal(false);
      setRenameOrganizationName("");
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "Failed to rename organization.",
      );
    } finally {
      setIsRenamingOrganization(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    const response = await fetch(`/api/connections/${id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Failed to delete connection.");
      return;
    }

    setConnections((current) => current.filter((connection) => connection.id !== id));
  }

  async function handleSave(
    id: string,
    values: {
      name: string;
      mongoUrl?: string;
      locked: boolean;
      environment: "prod" | "staging" | "dev" | "local";
      organizationId: string;
    },
  ) {
    setError("");
    const response = await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as Connection | { error: string };

    if (!response.ok) {
      throw new Error("error" in payload ? payload.error : "Failed to update connection.");
    }

    setConnections((current) =>
      current.map((connection) =>
        connection.id === id ? (payload as Connection) : connection,
      ),
    );
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to change password.");
      }

      setShowChangePasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  }


  const lockedCount = connections.filter((connection) => connection.locked).length;

  function closeChangePasswordModal() {
    setShowChangePasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  function closeRecoveryModal() {
    setShowRecoveryModal(false);
    setRecoveryQuestion("");
    setRecoveryAnswer("");
    setConfirmRecoveryAnswer("");
  }

  function openRecoveryModal() {
    setError("");
    setRecoveryQuestion(existingRecoveryQuestion ?? "");
    setRecoveryAnswer("");
    setConfirmRecoveryAnswer("");
    setShowRecoveryModal(true);
  }

  async function handleSaveRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (recoveryAnswer !== confirmRecoveryAnswer) {
      setError("Recovery answers do not match.");
      return;
    }

    setIsSavingRecovery(true);

    try {
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: recoveryQuestion,
          answer: recoveryAnswer,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save recovery.");
      }

      await loadRecovery();
      closeRecoveryModal();
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Failed to save recovery.",
      );
    } finally {
      setIsSavingRecovery(false);
    }
  }

  async function handleClearRecovery() {
    setError("");
    setIsClearingRecovery(true);

    try {
      const response = await fetch("/api/auth/recovery", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove recovery.");
      }

      await loadRecovery();
      closeRecoveryModal();
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Failed to remove recovery.",
      );
    } finally {
      setIsClearingRecovery(false);
    }
  }

  function closeRenameModal() {
    setShowRenameOrganizationModal(false);
    setRenameOrganizationName("");
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Workspace"
        title={selectedOrganization?.name ?? "Your workspace"}
        description="Group MongoDB connections by organization. Every connection string is verified before saving and encrypted on this machine."
        actions={
          <>
            <Button icon={<IconShield size={15} />} onClick={openRecoveryModal}>
              {hasRecovery ? "Recovery" : "Add recovery"}
            </Button>
            <Button icon={<IconKey size={15} />} onClick={() => setShowChangePasswordModal(true)}>
              Change password
            </Button>
          </>
        }
      />

      {/* Organization bar */}
      <Card className="p-2">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
          <div className="flex items-center gap-2 p-2">
            <div className="min-w-0 flex-1">
              <OrganizationSelector
                organizations={organizations}
                selectedOrganizationId={selectedOrganizationId}
                onChange={setSelectedOrganizationId}
                hideLabel
              />
            </div>
            <Button
              disabled={!selectedOrganization}
              aria-label="Rename organization"
              title="Rename organization"
              size="icon"
              onClick={() => {
                setRenameOrganizationName(selectedOrganization?.name ?? "");
                setShowRenameOrganizationModal(true);
              }}
            >
              <IconPencil size={15} />
            </Button>
          </div>

          <span className="mx-2 hidden h-8 w-px bg-line md:block" />

          <form className="flex items-center gap-2 p-2" onSubmit={handleCreateOrganization}>
            <Input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="New organization name"
              aria-label="New organization name"
              required
            />
            <Button
              type="submit"
              variant="primary"
              loading={isSavingOrganization}
              icon={<IconPlus size={15} />}
            >
              {isSavingOrganization ? "Saving..." : "Create"}
            </Button>
          </form>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<IconBuilding size={16} />}
          label="Organizations"
          value={isLoading ? "–" : organizations.length}
        />
        <Stat
          icon={<IconDatabase size={16} />}
          label="Connections in this org"
          value={selectedOrganizationId ? connections.length : "–"}
        />
        <Stat
          icon={<IconLock size={16} />}
          label="Locked targets"
          value={selectedOrganizationId ? lockedCount : "–"}
        />
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Connections list */}
        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Connections</h2>
            <Badge>{connections.length} saved</Badge>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className="h-[132px] animate-pulse rounded-[var(--radius-card)] border border-line bg-surface"
                />
              ))}
            </div>
          ) : selectedOrganizationId === "" ? (
            <EmptyState icon={<IconBuilding size={20} />} title="Create your first organization">
              Organizations group related connections, such as a client or a product. Add one
              above to start saving connections.
            </EmptyState>
          ) : connections.length === 0 ? (
            <EmptyState icon={<IconDatabase size={20} />} title="No connections yet">
              Add a MongoDB connection string using the form. It&apos;s tested with a live ping
              before it&apos;s saved.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  onDelete={handleDelete}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add connection */}
        <Card className="p-5 xl:sticky xl:top-10">
          <CardHeader
            icon={<IconPlus size={17} />}
            title="Add connection"
            description={
              selectedOrganization
                ? `Saved to ${selectedOrganization.name}`
                : "Select an organization first"
            }
          />
          <form className="mt-5 grid gap-4" onSubmit={handleCreateConnection}>
            <Field label="Name">
              <Input
                value={connectionName}
                onChange={(event) => setConnectionName(event.target.value)}
                placeholder="e.g. Production"
                required
              />
            </Field>
            <Field label="Connection string">
              <Input
                value={mongoUrl}
                onChange={(event) => setMongoUrl(event.target.value)}
                placeholder="mongodb+srv://user:pass@host"
                className="font-mono text-[13px]"
                required
              />
            </Field>
            <Field label="Environment">
              <select
                value={environment}
                onChange={(event) =>
                  setEnvironment(
                    event.target.value as "prod" | "staging" | "dev" | "local",
                  )
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
              label="Locked connection"
              description="Protect production: requires confirmation as a target."
            />
            <Button
              type="submit"
              variant="accent"
              loading={isSavingConnection}
              disabled={!selectedOrganizationId}
              className="w-full"
            >
              {isSavingConnection ? "Checking and saving..." : "Verify & save"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <IconShield size={13} />
              Verified with MongoDB, then encrypted locally.
            </p>
          </form>
        </Card>
      </div>

      <Modal
        title="Rename organization"
        description="Update the name of the currently selected organization."
        isOpen={showRenameOrganizationModal}
        onClose={closeRenameModal}
        icon={<IconPencil size={17} />}
      >
        <form className="grid gap-4" onSubmit={handleRenameOrganization}>
          <Input
            value={renameOrganizationName}
            onChange={(event) => setRenameOrganizationName(event.target.value)}
            placeholder="Organization name"
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button onClick={closeRenameModal}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isRenamingOrganization}>
              {isRenamingOrganization ? "Renaming..." : "Save name"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Change master password"
        description="Existing saved connections will be re-encrypted with the new password."
        isOpen={showChangePasswordModal}
        onClose={closeChangePasswordModal}
        icon={<IconKey size={17} />}
      >
        <form className="grid gap-4" onSubmit={handleChangePassword}>
          <Field label="Current password">
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={closeChangePasswordModal}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={hasRecovery ? "Update recovery" : "Add recovery"}
        description="Set a question and answer you can use to reset the master password without deleting connections. Answers are normalized (lowercase, no spaces)."
        isOpen={showRecoveryModal}
        onClose={closeRecoveryModal}
        icon={<IconShield size={17} />}
      >
        <form className="grid gap-4" onSubmit={handleSaveRecovery}>
          <Field label="Recovery question">
            <Input
              value={recoveryQuestion}
              onChange={(event) => setRecoveryQuestion(event.target.value)}
              placeholder="e.g. What city were you born in?"
              autoFocus
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
              onChange={(event) => setConfirmRecoveryAnswer(event.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {hasRecovery ? (
              <Button
                type="button"
                variant="danger-soft"
                loading={isClearingRecovery}
                onClick={() => void handleClearRecovery()}
              >
                {isClearingRecovery ? "Removing..." : "Remove recovery"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" onClick={closeRecoveryModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSavingRecovery}>
                {isSavingRecovery ? "Saving..." : "Save recovery"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-paper text-muted ring-1 ring-line">
        {icon}
      </span>
      <div>
        <p className="font-display text-xl font-semibold leading-none tracking-[-0.02em] text-ink">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}
