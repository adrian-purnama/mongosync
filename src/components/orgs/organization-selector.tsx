"use client";

import { SearchableDropdown } from "@/src/components/shared/searchable-dropdown";
import type { Organization } from "@/src/types/models";

type OrganizationSelectorProps = {
  organizations: Organization[];
  selectedOrganizationId: string;
  onChange: (organizationId: string) => void;
};

export function OrganizationSelector({
  organizations,
  selectedOrganizationId,
  onChange,
}: OrganizationSelectorProps) {
  const options = organizations.map((organization) => ({
    value: organization.id,
    label: organization.name,
  }));

  return (
    <SearchableDropdown
      label="Organization"
      value={selectedOrganizationId}
      options={options}
      placeholder="Select an organization"
      onChange={onChange}
    />
  );
}
