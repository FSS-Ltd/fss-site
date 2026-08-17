import type { GrowthQueryExecutor } from "../types";

export type IntegrationConnectionProvider = "gmail" | "resend" | "vercel_blob";

export type IntegrationConnectionStatus =
  | "disconnected"
  | "connected"
  | "degraded"
  | "error"
  | "revoked";

export type IntegrationConnectionHealth = {
  provider: IntegrationConnectionProvider;
  status: IntegrationConnectionStatus;
  lastSyncedAt: Date | null;
};

const MAX_INTEGRATION_CONNECTIONS = 5;

export async function listIntegrationConnectionHealth(
  db: GrowthQueryExecutor,
  subjectEmail: string,
  limit = MAX_INTEGRATION_CONNECTIONS,
): Promise<readonly IntegrationConnectionHealth[]> {
  const normalisedSubjectEmail = subjectEmail.trim().toLowerCase();

  if (!normalisedSubjectEmail) {
    throw new TypeError("Integration health requires a subject email.");
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_INTEGRATION_CONNECTIONS
  ) {
    throw new RangeError(
      `Integration health limit must be between 1 and ${MAX_INTEGRATION_CONNECTIONS}.`,
    );
  }

  return db<IntegrationConnectionHealth[]>`
    select
      ic.provider,
      ic.status,
      ic.last_synced_at as "lastSyncedAt"
    from growth.integration_connections ic
    where ic.subject_email = ${normalisedSubjectEmail}
    order by ic.provider
    limit ${limit}
  `;
}
