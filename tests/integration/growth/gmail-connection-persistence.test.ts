import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
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
    const thirdCorrelationId = `gmail-same-subject-${testId}`;
    const rejectedCorrelationId = `gmail-rejected-${testId}`;
    const encryptionKey = Buffer.alloc(32, 7);
    const firstEncryptedToken = encryptRefreshToken("first-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });
    const secondEncryptedToken = encryptRefreshToken("second-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });

    const thirdEncryptedToken = encryptRefreshToken("third-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });

    const rejectedEncryptedToken = encryptRefreshToken(
      "rejected-refresh-token",
      {
        version: "v1",
        key: encryptionKey,
      },
    );

    try {
      const firstConnectionId = await storeConnectedGmailConnection(sql, {
        subjectEmail,
        googleSubject: "test-google-subject",
        encryptedRefreshToken: firstEncryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
        correlationId: firstCorrelationId,
        actorId: "integration-test-founder",
      });
      const [initial] = await sql<Array<{ googleSubject: string | null }>>`
        select google_subject as "googleSubject" from growth.integration_connections where id = ${firstConnectionId}
      `;
      assert.equal(initial?.googleSubject, "test-google-subject");
      // Simulate a connection created before subject persistence existed.
      await sql`update growth.integration_connections set google_subject = null where id = ${firstConnectionId}`;
      const secondConnectionId = await storeConnectedGmailConnection(sql, {
        subjectEmail,
        googleSubject: "test-google-subject",
        encryptedRefreshToken: secondEncryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T14:00:00.000Z"),
        correlationId: secondCorrelationId,
        actorId: "integration-test-founder",
      });

      assert.equal(secondConnectionId, firstConnectionId);
      const [afterLegacy] = await sql<
        Array<{ googleSubject: string | null; version: number }>
      >`
        select google_subject as "googleSubject", version from growth.integration_connections where id = ${firstConnectionId}
      `;
      assert.deepEqual(afterLegacy, {
        googleSubject: "test-google-subject",
        version: 2,
      });
      const thirdConnectionId = await storeConnectedGmailConnection(sql, {
        subjectEmail,
        googleSubject: "test-google-subject",
        encryptedRefreshToken: thirdEncryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T15:00:00.000Z"),
        correlationId: thirdCorrelationId,
        actorId: "integration-test-founder",
      });
      assert.equal(thirdConnectionId, firstConnectionId);
      await assert.rejects(
        storeConnectedGmailConnection(sql, {
          subjectEmail,
          googleSubject: "different-google-subject",
          encryptedRefreshToken: rejectedEncryptedToken,
          grantedScopes: ["openid", "email", "gmail.modify"],
          accessTokenExpiresAt: new Date("2026-08-17T14:00:00.000Z"),
          correlationId: rejectedCorrelationId,
          actorId: "integration-test-founder",
        }),
      );

      const [connection] = await sql<
        Array<{
          id: string;
          googleSubject: string | null;
          encryptedRefreshToken: string;
          status: string;
          providerCursor: string | null;
          lastErrorCode: string | null;
          version: number;
        }>
      >`
        select
          id,
          google_subject as "googleSubject",
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
        where correlation_id in (${firstCorrelationId}, ${secondCorrelationId}, ${thirdCorrelationId}, ${rejectedCorrelationId})
        order by correlation_id
      `;

      assert.deepEqual(connection, {
        id: firstConnectionId,
        googleSubject: "test-google-subject",
        encryptedRefreshToken: JSON.stringify(thirdEncryptedToken),
        status: "connected",
        providerCursor: null,
        lastErrorCode: null,
        version: 3,
      });
      await postgresGmailSyncRepository.setCursor(sql, subjectEmail, "12345");
      const [afterSync] = await sql<Array<{ version: number }>>`
        select version from growth.integration_connections where id = ${firstConnectionId}
      `;
      assert.equal(afterSync?.version, 3);
      assert.deepEqual(
        auditEvents.map((event) => event.correlationId),
        [firstCorrelationId, secondCorrelationId, thirdCorrelationId].sort(),
      );
    } finally {
      await sql`
        delete from growth.audit_log
        where correlation_id in (${firstCorrelationId}, ${secondCorrelationId}, ${thirdCorrelationId}, ${rejectedCorrelationId})
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
