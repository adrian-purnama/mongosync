"use client";

import { SearchableDropdown } from "@/src/components/shared/searchable-dropdown";
import { IconBuilding } from "@/src/components/ui/icons";
import type { Organization } from "@/src/types/models";

type OrganizationSelectorProps = {
  organizations: Organization[];
  selectedOrganizationId: string;
  onChange: (organizationId: string) => void;
  hideLabel?: boolean;
};

export function OrganizationSelector({
  organizations,
  selectedOrganizationId,
  onChange,
  hideLabel,
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
      icon={<IconBuilding />}
      hideLabel={hideLabel}
    />
  );
}
