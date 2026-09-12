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

export function getPortalAccessMetrics(
  entries: readonly PortalAccessEntry[],
  now: Date = new Date(),
): {
  active: number;
  claimed: number;
  pending: number;
  roleCounts: readonly (PortalRoleOption & { count: number })[];
} {
  const active = entries.filter(
    (entry) => entry.membershipId && !entry.revokedAt,
  ).length;
  const pending = entries.filter(
    (entry) =>
      Boolean(entry.invitedAt) &&
      !entry.inviteClaimedAt &&
      !(entry.inviteExpiresAt && entry.inviteExpiresAt < now),
  ).length;
  const claimed = entries.filter(
    (entry) => entry.inviteClaimedAt && !entry.membershipId,
  ).length;
  const roleCounts = portalRoleOptions.map((role) => ({
    ...role,
    count: entries.filter((entry) => entry.role === role.value).length,
  }));

  return { active, claimed, pending, roleCounts };
}
