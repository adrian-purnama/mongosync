"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectionCard } from "@/src/components/connections/connection-card";
import { OrganizationSelector } from "@/src/components/orgs/organization-selector";
import { Modal } from "@/src/components/shared/modal";
import { useSelectedOrganization } from "@/src/hooks/use-selected-organization";
import type { Connection, Organization } from "@/src/types/models";

export function OrganizationConnectionsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [mongoUrl, setMongoUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [isRenamingOrganization, setIsRenamingOrganization] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showRenameOrganizationModal, setShowRenameOrganizationModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
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

  useEffect(() => {
    void (async () => {
      try {
        await loadOrganizations();
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

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Workspace</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Create an organization, switch active organization, and manage its
          MongoDB connections in one place.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <OrganizationSelector
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onChange={setSelectedOrganizationId}
          />

          <form className="flex gap-2" onSubmit={handleCreateOrganization}>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Add organization"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2"
              required
            />
            <button
              type="submit"
              disabled={isSavingOrganization}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSavingOrganization ? "Saving..." : "Create"}
            </button>
          </form>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedOrganization}
              onClick={() => {
                setRenameOrganizationName(selectedOrganization?.name ?? "");
                setShowRenameOrganizationModal(true);
              }}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Rename organization
            </button>
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100"
            >
              Change password
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-950">Connections</h3>
          <span className="text-sm text-zinc-500">{connections.length} visible</span>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateConnection}>
          <input
            value={connectionName}
            onChange={(event) => setConnectionName(event.target.value)}
            placeholder="Connection name"
            className="rounded-md border border-zinc-300 px-3 py-2"
            required
          />
          <input
            value={mongoUrl}
            onChange={(event) => setMongoUrl(event.target.value)}
            placeholder="mongodb://..."
            className="rounded-md border border-zinc-300 px-3 py-2"
            required
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={locked}
              onChange={(event) => setLocked(event.target.checked)}
            />
            Locked connection
          </label>
          <button
            type="submit"
            disabled={isSavingConnection || !selectedOrganizationId}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSavingConnection ? "Checking and saving..." : "Add connection"}
          </button>
        </form>

        <p className="mt-4 text-sm text-zinc-500">
          New connections are verified with MongoDB before they are saved.
        </p>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading workspace data...</p>
          ) : selectedOrganizationId === "" ? (
            <p className="text-sm text-zinc-500">Select an organization to manage connections.</p>
          ) : connections.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No connections yet for this organization.
            </p>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
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
        </div>
      </section>

      <Modal
        title="Rename organization"
        description="Update the name of the currently selected organization."
        isOpen={showRenameOrganizationModal}
        onClose={() => {
          setShowRenameOrganizationModal(false);
          setRenameOrganizationName("");
        }}
      >
        <form className="grid gap-3" onSubmit={handleRenameOrganization}>
          <input
            value={renameOrganizationName}
            onChange={(event) => setRenameOrganizationName(event.target.value)}
            placeholder="Organization name"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRenameOrganizationModal(false);
                setRenameOrganizationName("");
              }}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 shadow-sm transition hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenamingOrganization}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isRenamingOrganization ? "Renaming..." : "Save name"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Change master password"
        description="Enter your current password and a new password. Existing saved connections will be re-encrypted."
        isOpen={showChangePasswordModal}
        onClose={() => {
          setShowChangePasswordModal(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
        }}
      >
        <form className="grid gap-3" onSubmit={handleChangePassword}>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="Confirm new password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(false)}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 shadow-sm transition hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isChangingPassword ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
