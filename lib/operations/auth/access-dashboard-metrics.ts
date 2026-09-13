import type { PortalAccessEntry } from "./repository";
import { getPortalRolePresentation } from "./permissions";
import { portalRoles, type PortalRole } from "./types";

type PortalRoleOption = {
  value: PortalRole;
  label: string;
  detail: string;
};

export const portalRoleOptions: readonly PortalRoleOption[] = [
  ...portalRoles.map((value) => ({
    value,
    ...getPortalRolePresentation(value),
  })),
];

export function getPortalAccessMetrics(entries: readonly PortalAccessEntry[]): {
  active: number;
  roleCounts: readonly (PortalRoleOption & { count: number })[];
} {
  const activeEntries = entries.filter(
    (entry) => entry.membershipId && !entry.revokedAt,
  );
  const roleCounts = portalRoleOptions.map((role) => ({
    ...role,
    count: activeEntries.filter((entry) => entry.role === role.value).length,
  }));

  return { active: activeEntries.length, roleCounts };
}
