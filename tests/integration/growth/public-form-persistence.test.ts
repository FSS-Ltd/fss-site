import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { withGrowthTransaction } from "../../../lib/growth/db/client";
import {
  createSubmitLeadRepository,
  submitLead,
  submitLeadInTransaction,
  type SubmitLeadInput,
} from "../../../lib/growth/inbound/submit-lead";

const connectionString = process.env.DIRECT_DATABASE_URL;

function leadInput(overrides: Partial<SubmitLeadInput> = {}): SubmitLeadInput {
  return {
    submissionId: randomUUID(),
    submissionType: "site_enquiry",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: `integration-lead-${randomUUID()}@example.test`,
    businessName: "Lovelace Systems",
    sourcePath: "/contact",
    sourceContext: "contact_form",
    newsletterOptIn: false,
    ...overrides,
  };
}

test(
  "public lead submissions persist to PostgreSQL with idempotency, consent, and audit",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 4 });
    const input = leadInput();

    try {
      const result = await submitLeadInTransaction(input, sql);
      assert.equal(result.alreadySubmitted, false);

      const [leadRow] = await sql<
        { workEmail: string; businessName: string; newsletterOptIn: boolean }[]
      >`
        select work_email as "workEmail", business_name as "businessName",
               newsletter_opt_in as "newsletterOptIn"
        from growth.inbound_leads
        where submission_id = ${input.submissionId}
      `;
      assert.equal(leadRow.workEmail, input.workEmail);
      assert.equal(leadRow.businessName, input.businessName);
      assert.equal(leadRow.newsletterOptIn, false);

      const [auditRow] = await sql<{ entityType: string; entityId: string }[]>`
        select entity_type as "entityType", entity_id as "entityId"
        from growth.audit_log
        where correlation_id = ${input.submissionId}
      `;
      assert.equal(auditRow.entityType, "inbound_lead");
      assert.equal(auditRow.entityId, result.leadId);

      const subscriberRows = await sql`
        select 1 from growth.newsletter_subscribers where normalised_email = ${input.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberRows.length, 0, "no consent recorded when the box was not ticked");

      const replay = await submitLeadInTransaction(input, sql);
      assert.equal(replay.alreadySubmitted, true);
      assert.equal(replay.leadId, result.leadId);

      const leadCount = await sql`
        select 1 from growth.inbound_leads where submission_id = ${input.submissionId}
      `;
      assert.equal(leadCount.length, 1, "a replayed submission does not duplicate the lead row");

      const auditCount = await sql`
        select 1 from growth.audit_log where correlation_id = ${input.submissionId}
      `;
      assert.equal(auditCount.length, 1, "a replayed submission does not duplicate the audit event");
    } finally {
      await sql`delete from growth.audit_log where correlation_id = ${input.submissionId}`;
      await sql`delete from growth.inbound_leads where submission_id = ${input.submissionId}`;
      await sql.end();
    }
  },
);

test(
  "records newsletter consent for real when the opt-in box is true",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 4 });
    const input = leadInput({ newsletterOptIn: true });

    try {
      await submitLeadInTransaction(input, sql);

      const [subscriberRow] = await sql<
        { status: string; consentSource: string; consentTextVersion: string }[]
      >`
        select status, consent_source as "consentSource", consent_text_version as "consentTextVersion"
        from growth.newsletter_subscribers
        where normalised_email = ${input.workEmail.toLowerCase()}
      `;
      assert.equal(subscriberRow.status, "subscribed");
      assert.equal(subscriberRow.consentSource, "lead_capture_form");
      assert.equal(subscriberRow.consentTextVersion, "v1");
    } finally {
      await sql`delete from growth.newsletter_subscribers where normalised_email = ${input.workEmail.toLowerCase()}`;
      await sql`delete from growth.inbound_leads where submission_id = ${input.submissionId}`;
      await sql.end();
    }
  },
);

test(
  "the submission transaction rolls back fully on a database error",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 4 });
    const input = leadInput();

    try {
      await assert.rejects(
        withGrowthTransaction(sql, async (tx) => {
          const repository = createSubmitLeadRepository(tx);
          return submitLead(input, {
            ...repository,
            appendLeadAuditEvent: async () => {
              throw new Error("forced failure to verify rollback");
            },
          });
        }),
        /forced failure to verify rollback/,
      );

      const leadRows = await sql`
        select 1 from growth.inbound_leads where submission_id = ${input.submissionId}
      `;
      assert.equal(leadRows.length, 0, "the inbound lead insert was rolled back with the rest of the transaction");
    } finally {
      await sql.end();
    }
  },
);
