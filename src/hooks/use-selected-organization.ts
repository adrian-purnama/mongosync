"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mongosync.selectedOrganizationId";

export function useSelectedOrganization(organizationIds: string[]) {
  const [storedOrganizationId, setStoredOrganizationId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  });

  const selectedOrganizationId = organizationIds.includes(storedOrganizationId)
    ? storedOrganizationId
    : (organizationIds[0] ?? "");

  useEffect(() => {
    if (selectedOrganizationId) {
      window.localStorage.setItem(STORAGE_KEY, selectedOrganizationId);
    }
  }, [selectedOrganizationId]);

  return {
    selectedOrganizationId,
    setSelectedOrganizationId: setStoredOrganizationId,
  };
}
