import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import {
  disconnectStoredGmailConnection,
  storeConnectedGmailConnection,
} from "../../../lib/growth/db/repositories/integration-connections";
import { disconnectGmail } from "../../../lib/growth/integrations/gmail-disconnect";
import {
  decryptRefreshToken,
  encryptRefreshToken,
} from "../../../lib/growth/integrations/token-crypto";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "Gmail disconnect clears credentials and pauses only Gmail enrollments atomically",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 1 });
    const testId = randomUUID();
    const subjectEmail = `gmail-disconnect-${testId}@example.test`;
    const contactEmail = `gmail-disconnect-contact-${testId}@example.test`;
    const connectCorrelationId = `gmail-connect-${testId}`;
    const disconnectCorrelationId = `gmail-disconnect-${testId}`;
    const encryptionKey = Buffer.alloc(32, 11);
    const encryptedToken = encryptRefreshToken("disconnect-refresh-token", {
      version: "v1",
      key: encryptionKey,
    });
    let businessId: string | undefined;
    let contactId: string | undefined;
    let prospectId: string | undefined;
    let gmailEnrollmentId: string | undefined;
    let resendEnrollmentId: string | undefined;

    try {
      await storeConnectedGmailConnection(sql, {
        subjectEmail,
        encryptedRefreshToken: encryptedToken,
        grantedScopes: ["openid", "email", "gmail.modify"],
        accessTokenExpiresAt: new Date("2026-08-17T13:00:00.000Z"),
        correlationId: connectCorrelationId,
        actorId: "integration-test-founder",
      });

      const [business] = await sql<Array<{ id: string }>>`
        insert into growth.businesses (
          legal_name,
          corporate_type,
          corporate_status,
          sector,
          locality,
          county,
          first_party_source_url,
          verified_at
        ) values (
          ${`Gmail Disconnect Test ${testId}`},
          'limited_company',
          'active',
          'Technology',
          'Canterbury',
          'Kent',
          ${`https://example.test/gmail-disconnect/${testId}`},
          now()
        )
        returning id
      `;
      businessId = business.id;

      const [contact] = await sql<Array<{ id: string }>>`
        insert into growth.contacts (
          business_id,
          first_name,
          last_name,
          email,
          email_source_url,
          email_verified_at,
          subscriber_type,
          lawful_basis
        ) values (
          ${businessId},
          'Gmail',
          'Disconnect',
          ${contactEmail},
          ${`https://example.test/gmail-disconnect-contact/${testId}`},
          now(),
          'corporate',
          'legitimate_interests'
        )
        returning id
      `;
      contactId = contact.id;

      const [prospect] = await sql<Array<{ id: string }>>`
        insert into growth.prospects (
          business_id,
          primary_contact_id,
          fit_score,
          opportunity_summary,
          recommended_offer,
          estimated_one_off_min_pence,
          estimated_one_off_max_pence,
          assigned_owner_email
        ) values (
          ${businessId},
          ${contactId},
          80,
          'Gmail disconnect integration test',
          'Growth OS',
          100000,
          200000,
          'j.ntagengwa@faithfulsoftware.dev'
        )
        returning id
      `;
      prospectId = prospect.id;

      const enrollments = await sql<Array<{ id: string }>>`
        insert into growth.sequence_enrollments (
          prospect_id,
          contact_id,
          status,
          template_snapshot,
          started_at
        ) values
          (${prospectId}, ${contactId}, 'active', '{}'::jsonb, now()),
          (${prospectId}, ${contactId}, 'active', '{}'::jsonb, now())
        returning id
      `;
      gmailEnrollmentId = enrollments[0].id;
      resendEnrollmentId = enrollments[1].id;

      await sql`
        insert into growth.email_messages (
          sequence_enrollment_id,
          prospect_id,
          contact_id,
          channel,
          direction,
          step_number,
          status,
          idempotency_key
        ) values
          (
            ${gmailEnrollmentId},
            ${prospectId},
            ${contactId},
            'gmail',
            'outbound',
            0,
            'draft',
            ${`gmail-disconnect-gmail-${testId}`}
          ),
          (
            ${resendEnrollmentId},
            ${prospectId},
            ${contactId},
            'resend',
            'outbound',
            0,
            'draft',
            ${`gmail-disconnect-resend-${testId}`}
          )
      `;

      const result = await disconnectGmail(
        sql,
        {
          subjectEmail,
          encryptionKeys: { v1: encryptionKey },
          correlationId: disconnectCorrelationId,
          actorId: "integration-test-founder",
        },
        {
          decryptToken: decryptRefreshToken,
          revokeToken: async (refreshToken) => {
            assert.equal(refreshToken, "disconnect-refresh-token");
            return true;
          },
          disconnectStoredConnection: disconnectStoredGmailConnection,
        },
      );

      assert.equal(result.providerRevocation, "confirmed");
      assert.equal(result.pausedEnrollmentCount, 1);

      const [connection] = await sql<
        Array<{
          encryptedRefreshToken: string | null;
          encryptionKeyVersion: string | null;
          grantedScopes: string[];
          status: string;
          lastErrorCode: string | null;
          version: number;
        }>
      >`
        select
          encrypted_refresh_token as "encryptedRefreshToken",
          encryption_key_version as "encryptionKeyVersion",
          granted_scopes as "grantedScopes",
          status,
          last_error_code as "lastErrorCode",
          version
        from growth.integration_connections
        where provider = 'gmail'
          and subject_email = ${subjectEmail}
      `;
      assert.deepEqual(connection, {
        encryptedRefreshToken: null,
        encryptionKeyVersion: null,
        grantedScopes: [],
        status: "revoked",
        lastErrorCode: null,
        version: 2,
      });

      const enrollmentStatuses = await sql<
        Array<{ id: string; status: string }>
      >`
        select id, status
        from growth.sequence_enrollments
        where id in (${gmailEnrollmentId}, ${resendEnrollmentId})
        order by id
      `;
      assert.equal(
        enrollmentStatuses.find(({ id }) => id === gmailEnrollmentId)?.status,
        "paused",
      );
      assert.equal(
        enrollmentStatuses.find(({ id }) => id === resendEnrollmentId)?.status,
        "active",
      );

      const auditActions = await sql<Array<{ action: string }>>`
        select action
        from growth.audit_log
        where correlation_id = ${disconnectCorrelationId}
        order by action
      `;
      assert.deepEqual(
        auditActions.map(({ action }) => action),
        [
          "integration.gmail.disconnected",
          "sequence.paused_gmail_disconnected",
        ],
      );
    } finally {
      await sql`
        delete from growth.audit_log
        where correlation_id in (${connectCorrelationId}, ${disconnectCorrelationId})
      `;
      if (gmailEnrollmentId && resendEnrollmentId) {
        await sql`
          delete from growth.email_messages
          where sequence_enrollment_id in (${gmailEnrollmentId}, ${resendEnrollmentId})
        `;
        await sql`
          delete from growth.sequence_enrollments
          where id in (${gmailEnrollmentId}, ${resendEnrollmentId})
        `;
      }
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail'
          and subject_email = ${subjectEmail}
      `;
      if (prospectId) {
        await sql`delete from growth.prospects where id = ${prospectId}`;
      }
      if (contactId) {
        await sql`delete from growth.contacts where id = ${contactId}`;
      }
      if (businessId) {
        await sql`delete from growth.businesses where id = ${businessId}`;
      }
      await sql.end();
    }
  },
);
