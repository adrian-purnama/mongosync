"use client";

import { useEffect, useMemo, useState } from "react";

import { ConnectionCard } from "@/src/components/connections/connection-card";
import { OrganizationSelector } from "@/src/components/orgs/organization-selector";
import { useSelectedOrganization } from "@/src/hooks/use-selected-organization";
import type { Connection, Organization } from "@/src/types/models";

export function ConnectionsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [mongoUrl, setMongoUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const organizationIds = useMemo(
    () => organizations.map((organization) => organization.id),
    [organizations],
  );
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useSelectedOrganization(organizationIds);

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

  async function handleCreateConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
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
      setName("");
      setMongoUrl("");
      setLocked(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create connection.");
    } finally {
      setIsSaving(false);
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

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <OrganizationSelector
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onChange={setSelectedOrganizationId}
          />

          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateConnection}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
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
              disabled={isSaving || !selectedOrganizationId}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? "Checking and saving..." : "Add connection"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-sm text-zinc-500">
          New connections are verified with MongoDB before they are saved.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          If an Atlas `mongodb+srv://` URL fails here but works in Compass, use the
          standard `mongodb://host1,host2,host3/...` connection string instead.
        </p>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">Connections</h2>
          <span className="text-sm text-zinc-500">{connections.length} visible</span>
        </div>

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
      </section>
    </div>
  );
}
