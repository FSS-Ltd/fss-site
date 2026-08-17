import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { storeConnectedGmailConnection } from "../../../lib/growth/db/repositories/integration-connections";
import { encryptRefreshToken } from "../../../lib/growth/integrations/token-crypto";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "Gmail connection persistence upserts and audits atomically",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });
    const testId = randomUUID();
    const subjectEmail = `gmail-persistence-${testId}@example.test`;
    const firstCorrelationId = `gmail-connect-${testId}`;
    const secondCorrelationId = `gmail-reconnect-${testId}`;
    const encryptionKey = Buffer.alloc(32, 7);
    const firstEncryptedToken = encryptRefreshToken("first-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });
    const secondEncryptedToken = encryptRefreshToken("second-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });

    try {
      const firstConnectionId = await storeConnectedGmailConnection(sql, {
        subjectEmail,
        encryptedRefreshToken: firstEncryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
        correlationId: firstCorrelationId,
        actorId: "integration-test-founder",
      });
      const secondConnectionId = await storeConnectedGmailConnection(sql, {
        subjectEmail,
        encryptedRefreshToken: secondEncryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T14:00:00.000Z"),
        correlationId: secondCorrelationId,
        actorId: "integration-test-founder",
      });

      assert.equal(secondConnectionId, firstConnectionId);

      const [connection] = await sql<
        Array<{
          id: string;
          encryptedRefreshToken: string;
          status: string;
          providerCursor: string | null;
          lastErrorCode: string | null;
          version: number;
        }>
      >`
        select
          id,
          encrypted_refresh_token as "encryptedRefreshToken",
          status,
          provider_cursor as "providerCursor",
          last_error_code as "lastErrorCode",
          version
        from growth.integration_connections
        where provider = 'gmail'
          and subject_email = ${subjectEmail}
      `;
      const auditEvents = await sql<Array<{ correlationId: string }>>`
        select correlation_id as "correlationId"
        from growth.audit_log
        where correlation_id in (${firstCorrelationId}, ${secondCorrelationId})
        order by correlation_id
      `;

      assert.deepEqual(connection, {
        id: firstConnectionId,
        encryptedRefreshToken: JSON.stringify(secondEncryptedToken),
        status: "connected",
        providerCursor: null,
        lastErrorCode: null,
        version: 2,
      });
      assert.deepEqual(
        auditEvents.map((event) => event.correlationId),
        [firstCorrelationId, secondCorrelationId].sort(),
      );
    } finally {
      await sql`
        delete from growth.audit_log
        where correlation_id in (${firstCorrelationId}, ${secondCorrelationId})
      `;
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail'
          and subject_email = ${subjectEmail}
      `;
      await sql.end();
    }
  },
);
