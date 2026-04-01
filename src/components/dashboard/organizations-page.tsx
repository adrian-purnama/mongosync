"use client";

import { useEffect, useState } from "react";

import type { Organization } from "@/src/types/models";

export function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadOrganizations() {
    setIsLoading(true);
    const response = await fetch("/api/organizations", {
      cache: "no-store",
    });
    const payload = (await response.json()) as Organization[] | { error: string };

    if (!response.ok) {
      throw new Error("error" in payload ? payload.error : "Failed to load organizations.");
    }

    setOrganizations(payload as Organization[]);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadOrganizations().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load organizations.");
      setIsLoading(false);
    });
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json()) as Organization | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Failed to create organization.");
      }

      setOrganizations((current) =>
        [...current, payload as Organization].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create organization.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">Organizations</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Group related Mongo connections so source and target selection stays clean.
        </p>

        <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleCreate}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Add an organization"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Create"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-950">Saved organizations</h3>
          <span className="text-sm text-zinc-500">{organizations.length} total</span>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading organizations...</p>
        ) : organizations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Create your first organization to start managing connections.
          </p>
        ) : (
          <div className="grid gap-3">
            {organizations.map((organization) => (
              <div
                key={organization.id}
                className="rounded-lg border border-zinc-200 px-4 py-3"
              >
                <div className="font-medium text-zinc-950">{organization.name}</div>
                <div className="text-sm text-zinc-500">
                  Created {new Date(organization.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
