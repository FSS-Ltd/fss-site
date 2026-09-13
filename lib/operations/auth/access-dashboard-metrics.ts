import type { PortalAccessEntry } from "./repository";
import type { PortalRole } from "./types";

type PortalRoleOption = {
  value: PortalRole;
  label: string;
  detail: string;
};

export const portalRoleOptions: readonly PortalRoleOption[] = [
  {
    value: "owner",
    label: "Owner",
    detail: "Full project, agreement and account access.",
  },
  {
    value: "contributor",
    label: "Contributor",
    detail: "Project access, requests and shared files.",
  },
  {
    value: "billing_contact",
    label: "Billing contact",
    detail: "Billing records and payment management.",
  },
  {
    value: "viewer",
    label: "Viewer",
    detail: "Read-only projects, documents and services.",
  },
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
