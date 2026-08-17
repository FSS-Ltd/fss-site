import { appendAuditEvent } from "../../audit/service";
import type { EncryptedToken } from "../../integrations/token-crypto";
import { withGrowthTransaction } from "../client";
import type { GrowthDb, GrowthQueryExecutor } from "../types";

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

export type StoreConnectedGmailConnectionInput = {
  subjectEmail: string;
  encryptedRefreshToken: EncryptedToken;
  grantedScopes: readonly string[];
  accessTokenExpiresAt: Date;
  correlationId: string;
  actorId: string;
};

export class IntegrationConnectionPersistenceError extends Error {
  constructor() {
    super("The Gmail connection could not be stored.");
    this.name = "IntegrationConnectionPersistenceError";
  }
}

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

export function storeConnectedGmailConnection(
  db: GrowthDb,
  input: StoreConnectedGmailConnectionInput,
): Promise<string> {
  return withGrowthTransaction(db, async (transaction) => {
    const rows = await transaction<Array<{ id: string }>>`
      insert into growth.integration_connections as ic (
        provider,
        subject_email,
        encrypted_refresh_token,
        encryption_key_version,
        granted_scopes,
        access_token_expires_at,
        provider_cursor,
        status,
        last_synced_at,
        last_error_code
      ) values (
        'gmail',
        ${input.subjectEmail},
        ${JSON.stringify(input.encryptedRefreshToken)},
        ${input.encryptedRefreshToken.version},
        ${input.grantedScopes},
        ${input.accessTokenExpiresAt},
        null,
        'connected',
        null,
        null
      )
      on conflict (provider, subject_email) do update
      set encrypted_refresh_token = excluded.encrypted_refresh_token,
          encryption_key_version = excluded.encryption_key_version,
          granted_scopes = excluded.granted_scopes,
          access_token_expires_at = excluded.access_token_expires_at,
          provider_cursor = null,
          status = 'connected',
          last_synced_at = null,
          last_error_code = null,
          version = ic.version + 1,
          updated_at = now()
      returning id
    `;
    const connectionId = rows[0]?.id;

    if (!connectionId) {
      throw new IntegrationConnectionPersistenceError();
    }

    await appendAuditEvent(transaction, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.actorId,
      action: "integration.gmail.connected",
      entityType: "integration_connection",
      entityId: connectionId,
    });

    return connectionId;
  });
}
