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
