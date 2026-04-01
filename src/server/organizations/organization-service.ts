import { randomUUID } from "node:crypto";

import type { Organization } from "@/src/types/models";
import { getAppData, updateAppData } from "@/src/server/storage/config-store";
import { AppError } from "@/src/server/utils/errors";

export async function listOrganizations() {
  const data = await getAppData();
  return data.organizations.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createOrganization(name: string) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new AppError("Organization name is required.");
  }

  let createdOrganization: Organization | null = null;

  await updateAppData((current) => {
    const organization: Organization = {
      id: randomUUID(),
      name: normalizedName,
      createdAt: new Date().toISOString(),
    };

    createdOrganization = organization;

    return {
      ...current,
      organizations: [...current.organizations, organization],
    };
  });

  return createdOrganization;
}

export async function renameOrganization(id: string, name: string) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new AppError("Organization name is required.");
  }

  let renamedOrganization: Organization | null = null;

  await updateAppData((current) => {
    const organizations = current.organizations.map((organization) => {
      if (organization.id !== id) {
        return organization;
      }

      renamedOrganization = {
        ...organization,
        name: normalizedName,
      };

      return renamedOrganization;
    });

    if (!renamedOrganization) {
      throw new AppError("Organization not found.", 404);
    }

    return {
      ...current,
      organizations,
    };
  });

  return renamedOrganization;
}
