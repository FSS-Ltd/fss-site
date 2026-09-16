import { portalRoleOptions } from "./access-dashboard-metrics";
import type { PortalRole } from "./types";

export const accessStates = [
  "active",
  "pending",
  "revoked",
  "expired",
  "provider_failed",
  "inactive",
] as const;
export type AccessState = (typeof accessStates)[number];
export type FounderAccessEntry = {
  id: string;
  accessType: "client" | "admin";
  name: string;
  email: string;
  userId: string | null;
  membershipId: string | null;
  organisationId: string | null;
  organisationName: string | null;
  role: PortalRole | "admin";
  state: AccessState;
  invitedAt: string | null;
  joinedAt: string | null;
};

export const accessRoleOptions = [
  {
    value: "admin",
    label: "Admin",
    detail:
      "FSS operations across client organisations. Access is managed by the founder.",
  },
  ...portalRoleOptions,
] as const;

export type FounderAccessMetrics = {
  uniqueActiveUsers: number;
  clientUsers: number;
  admins: number;
  pendingInvitations: number;
  organisations: number;
  roleCounts: readonly {
    value: PortalRole | "admin";
    label: string;
    detail: string;
    count: number;
  }[];
};

export function getFounderAccessMetrics(
  entries: readonly FounderAccessEntry[],
  organisationCount: number,
): FounderAccessMetrics {
  const active = entries.filter(
    (entry) => entry.state === "active" && entry.userId !== null,
  );
  const users = (rows: readonly FounderAccessEntry[]) =>
    new Set(rows.map((entry) => entry.userId)).size;
  const normalizedEmail = (email: string) => email.trim().toLowerCase();
  const activeEmails = new Set(
    active.map((entry) => normalizedEmail(entry.email)),
  );
  return {
    uniqueActiveUsers: users(active),
    clientUsers: users(active.filter((entry) => entry.accessType === "client")),
    admins: users(active.filter((entry) => entry.accessType === "admin")),
    pendingInvitations: new Set(
      entries
        .filter(
          (entry) =>
            entry.state === "pending" &&
            !activeEmails.has(normalizedEmail(entry.email)),
        )
        .map((entry) => normalizedEmail(entry.email)),
    ).size,
    organisations: organisationCount,
    roleCounts: accessRoleOptions.map((role) => ({
      ...role,
      count: users(active.filter((entry) => entry.role === role.value)),
    })),
  };
}

export type FounderAccessOverview = {
  entries: readonly FounderAccessEntry[];
  metrics: FounderAccessMetrics;
};
