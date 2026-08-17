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

export type ProviderRevocation = "confirmed" | "unconfirmed" | "not_required";

export type StoredGmailCredential = {
  encryptedRefreshToken: string;
  encryptionKeyVersion: string;
};

export type DisconnectStoredGmailConnectionInput = {
  subjectEmail: string;
  correlationId: string;
  actorId: string;
  confirmProviderRevocation: (
    credential: StoredGmailCredential,
  ) => Promise<Exclude<ProviderRevocation, "not_required">>;
};

export type DisconnectStoredGmailConnectionResult = {
  connectionId: string | null;
  providerRevocation: ProviderRevocation;
  pausedEnrollmentCount: number;
};

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

export function disconnectStoredGmailConnection(
  db: GrowthDb,
  input: DisconnectStoredGmailConnectionInput,
): Promise<DisconnectStoredGmailConnectionResult> {
  const subjectEmail = input.subjectEmail.trim().toLowerCase();
  if (!subjectEmail) {
    throw new TypeError("Gmail disconnect requires a subject email.");
  }

  return withGrowthTransaction(db, async (transaction) => {
    const rows = await transaction<
      Array<{
        id: string;
        encryptedRefreshToken: string | null;
        encryptionKeyVersion: string | null;
      }>
    >`
      select
        ic.id,
        ic.encrypted_refresh_token as "encryptedRefreshToken",
        ic.encryption_key_version as "encryptionKeyVersion"
      from growth.integration_connections ic
      where ic.provider = 'gmail'
        and ic.subject_email = ${subjectEmail}
      for update
    `;
    const connection = rows[0];

    let providerRevocation: ProviderRevocation = "not_required";
    if (connection?.encryptedRefreshToken) {
      providerRevocation = connection.encryptionKeyVersion
        ? await input.confirmProviderRevocation({
            encryptedRefreshToken: connection.encryptedRefreshToken,
            encryptionKeyVersion: connection.encryptionKeyVersion,
          })
        : "unconfirmed";
    }

    if (connection) {
      await transaction`
        update growth.integration_connections
        set encrypted_refresh_token = null,
            encryption_key_version = null,
            granted_scopes = '{}',
            access_token_expires_at = null,
            provider_cursor = null,
            status = 'revoked',
            last_synced_at = null,
            last_error_code = case
              when ${providerRevocation} = 'unconfirmed'
                then 'provider_revocation_unconfirmed'
              else null
            end,
            version = version + 1,
            updated_at = now()
        where id = ${connection.id}
      `;
    }

    const pausedEnrollments = await transaction<Array<{ id: string }>>`
      update growth.sequence_enrollments se
      set status = 'paused',
          updated_at = now()
      where se.status = 'active'
        and exists (
          select 1
          from growth.email_messages em
          where em.sequence_enrollment_id = se.id
            and em.channel = 'gmail'
        )
      returning se.id
    `;

    if (connection) {
      await appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "integration.gmail.disconnected",
        entityType: "integration_connection",
        entityId: connection.id,
        metadata: {
          reasonCode:
            providerRevocation === "unconfirmed"
              ? "provider_revocation_unconfirmed"
              : "founder_disconnect",
        },
      });
    }

    for (const enrollment of pausedEnrollments) {
      await appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "sequence.paused_gmail_disconnected",
        entityType: "sequence_enrollment",
        entityId: enrollment.id,
        metadata: { reasonCode: "gmail_disconnected" },
      });
    }

    return {
      connectionId: connection?.id ?? null,
      providerRevocation,
      pausedEnrollmentCount: pausedEnrollments.length,
    };
  });
}
