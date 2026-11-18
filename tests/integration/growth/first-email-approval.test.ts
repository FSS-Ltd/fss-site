import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { postgresFirstEmailApprovalRepository } from "../../../lib/growth/sequences/approval-repository";
import {
  createFirstEmailApprover,
  FirstEmailApprovalError,
} from "../../../lib/growth/sequences/approval";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;
const founder = { email: "founder@example.test", actorId: "c".repeat(64) };

test(
  "founder first-email approval creates an enrollment, queues the message, and audits atomically",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const app = postgres(connectionString, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-email-approval-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `approval-${token}@example.test`;
    const correlationIds = [
      `${externalRunId}-queue`,
      `${externalRunId}-conflict`,
      `${externalRunId}-draft`,
    ];

    const approveQueued = createFirstEmailApprover({
      repository: postgresFirstEmailApprovalRepository,
      gmailClient: {
        createDraft: async () => ({
          draftId: "unused",
          messageId: "unused",
          gmailThreadId: "unused",
        }),
      },
      founderEmail: "j.ntagengwa@faithfulsoftware.dev",
      siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
    });

    try {
      const fixture = createValidResearchRunFixture();
      fixture.externalRunId = externalRunId;
      const candidate = fixture.prospects[0]!;
      candidate.business.companyNumber = companyNumber;
      candidate.business.googlePlaceId = `place-${token}`;
      candidate.contact.email = contactEmail;
      const companiesHouseEvidence = candidate.evidence.find(
        (evidence) => evidence.sourceType === "companies_house",
      );
      assert.ok(companiesHouseEvidence);
      companiesHouseEvidence.externalReference = companyNumber;
      companiesHouseEvidence.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

      const ingestion = await ingestResearchRun(sql, fixture);
      const prospectId = ingestion.acceptedProspects[0]!.prospectId;
      const [identity] = await sql<
        Array<{
          draftTaskId: string;
          contactId: string;
          contactVersion: number;
          prospectVersion: number;
          businessId: string;
        }>
      >`
        select p.business_id as "businessId", at.id as "draftTaskId", p.primary_contact_id as "contactId", c.version as "contactVersion", p.version as "prospectVersion"
        from growth.agent_tasks at
        join growth.prospects p on p.id = at.prospect_id
        join growth.contacts c on c.id = p.primary_contact_id
        where at.prospect_id = ${prospectId}
          and at.task_type = 'first_email_draft'
      `;
      assert.ok(identity);

      const staleRecipient = {
        email: contactEmail,
        contactId: identity.contactId,
        contactVersion: identity.contactVersion,
        prospectVersion: identity.prospectVersion,
      };
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = app.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`}, 0))`;
        started.resolve();
        await release.promise;
        await tx`update growth.contacts set version = version + 1 where id = ${identity.contactId}`;
      });
      await started.promise;
      const stale = approveQueued(app, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        reviewedRecipient: staleRecipient,
        founder,
        correlationId: `${externalRunId}-stale`,
        sendMode: "queue",
      });
      try {
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const [row] =
            await sql`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='advisory' and query like '%hashtextextended($1%') as waiting`;
          if (row?.waiting) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(waiting, true);
      } finally {
        release.resolve();
      }
      await holder;
      await assert.rejects(
        stale,
        (error: unknown) =>
          error instanceof FirstEmailApprovalError &&
          error.code === "version_conflict",
      );
      const [effects] =
        await sql`select (select count(*) from growth.sequence_enrollments where prospect_id = ${prospectId})::int as enrollments, (select count(*) from growth.email_messages where prospect_id = ${prospectId})::int as messages, (select count(*) from growth.audit_log where correlation_id = ${`${externalRunId}-stale`})::int as audits`;
      assert.deepEqual(effects, { enrollments: 0, messages: 0, audits: 0 });
      identity.contactVersion++;

      const first = await approveQueued(app, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        reviewedRecipient: {
          email: contactEmail,
          contactId: identity.contactId,
          contactVersion: identity.contactVersion,
          prospectVersion: identity.prospectVersion,
        },
        founder,
        correlationId: correlationIds[0]!,
        sendMode: "queue",
      });
      assert.equal(first.status, "queued");

      await assert.rejects(
        approveQueued(sql, {
          draftTaskId: identity.draftTaskId,
          expectedVersion: 1,
          reviewedRecipient: {
            email: contactEmail,
            contactId: identity.contactId,
            contactVersion: identity.contactVersion,
            prospectVersion: identity.prospectVersion,
          },
          founder,
          correlationId: correlationIds[1]!,
          sendMode: "queue",
        }),
        (error: unknown) =>
          error instanceof FirstEmailApprovalError &&
          error.code === "not_approvable",
      );

      const [enrollment] = await sql<
        Array<{ status: string; firstMessageId: string }>
      >`
        select status, first_message_id as "firstMessageId"
        from growth.sequence_enrollments
        where prospect_id = ${prospectId}
      `;
      assert.equal(enrollment?.status, "active");
      assert.equal(enrollment?.firstMessageId, first.messageId);

      const [message] = await sql<
        Array<{
          status: string;
          channel: string;
          scheduledFor: Date | null;
          rfcMessageId: string;
          idempotencyKey: string;
        }>
      >`
        select
          status,
          channel,
          scheduled_for as "scheduledFor",
          rfc_message_id as "rfcMessageId",
          idempotency_key as "idempotencyKey"
        from growth.email_messages
        where id = ${first.messageId}
      `;
      assert.equal(message?.status, "queued");
      assert.equal(message?.channel, "gmail");
      assert.ok(message?.scheduledFor);
      assert.equal(message?.rfcMessageId, first.rfcMessageId);
      assert.equal(
        message?.idempotencyKey,
        `first_email:${identity.draftTaskId}`,
      );

      const [draft] = await sql<Array<{ reviewState: string }>>`
        select output_snapshot ->> 'reviewState' as "reviewState"
        from growth.agent_tasks
        where id = ${identity.draftTaskId}
      `;
      assert.equal(draft?.reviewState, "approved");

      const audits = await sql<Array<{ correlationId: string }>>`
        select correlation_id as "correlationId"
        from growth.audit_log
        where correlation_id = any(${correlationIds}::text[])
      `;
      assert.deepEqual(
        audits.map((audit) => audit.correlationId),
        [correlationIds[0]],
      );
    } finally {
      await sql`
        update growth.sequence_enrollments
        set first_message_id = null
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.email_messages
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.sequence_enrollments
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.audit_log
        where correlation_id like ${`${externalRunId}%`}
      `;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.website_assessments
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospect_previews
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospects
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`delete from growth.contacts where email = ${contactEmail}`;
      await sql`delete from growth.businesses where company_number = ${companyNumber}`;
      await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
      await app.end();
      await sql.end();
    }
  },
);

test(
  "founder first-email approval revalidates suppression and creates a Gmail draft awaiting manual send",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-email-approval-draft-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `approval-draft-${token}@example.test`;
    const correlationId = `${externalRunId}-draft`;

    const createdDrafts: Array<{ raw: string }> = [];
    const approveDraft = createFirstEmailApprover({
      repository: postgresFirstEmailApprovalRepository,
      gmailClient: {
        createDraft: async (input) => {
          createdDrafts.push(input);
          return {
            draftId: "provider-draft-1",
            messageId: "provider-message-1",
            gmailThreadId: "provider-thread-1",
          };
        },
      },
      founderEmail: "j.ntagengwa@faithfulsoftware.dev",
      siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
    });

    try {
      const fixture = createValidResearchRunFixture();
      fixture.externalRunId = externalRunId;
      const candidate = fixture.prospects[0]!;
      candidate.business.companyNumber = companyNumber;
      candidate.business.googlePlaceId = `place-${token}`;
      candidate.contact.email = contactEmail;
      const companiesHouseEvidence = candidate.evidence.find(
        (evidence) => evidence.sourceType === "companies_house",
      );
      assert.ok(companiesHouseEvidence);
      companiesHouseEvidence.externalReference = companyNumber;
      companiesHouseEvidence.sourceUrl = `https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`;

      const ingestion = await ingestResearchRun(sql, fixture);
      const prospectId = ingestion.acceptedProspects[0]!.prospectId;
      const [identity] = await sql<
        Array<{
          draftTaskId: string;
          contactId: string;
          contactVersion: number;
          prospectVersion: number;
        }>
      >`
        select at.id as "draftTaskId", p.primary_contact_id as "contactId", c.version as "contactVersion", p.version as "prospectVersion"
        from growth.agent_tasks at
        join growth.prospects p on p.id = at.prospect_id
        join growth.contacts c on c.id = p.primary_contact_id
        where at.prospect_id = ${prospectId}
          and at.task_type = 'first_email_draft'
      `;
      assert.ok(identity);

      await sql`
        insert into growth.suppressions (
          normalised_email, reason, source, created_by
        ) values (
          ${contactEmail}, 'test suppression', 'integration_test', 'integration_test'
        )
      `;
      await assert.rejects(
        approveDraft(sql, {
          draftTaskId: identity.draftTaskId,
          expectedVersion: 1,
          reviewedRecipient: {
            email: contactEmail,
            contactId: identity.contactId,
            contactVersion: identity.contactVersion,
            prospectVersion: identity.prospectVersion,
          },
          founder,
          correlationId,
          sendMode: "gmail_draft",
        }),
        (error: unknown) =>
          error instanceof FirstEmailApprovalError &&
          error.code === "suppressed_contact",
      );
      await sql`delete from growth.suppressions where normalised_email = ${contactEmail}`;

      const result = await approveDraft(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        reviewedRecipient: {
          email: contactEmail,
          contactId: identity.contactId,
          contactVersion: identity.contactVersion,
          prospectVersion: identity.prospectVersion,
        },
        founder,
        correlationId,
        sendMode: "gmail_draft",
      });
      assert.equal(result.status, "provider_draft");
      assert.equal(createdDrafts.length, 1);

      const [enrollment] = await sql<Array<{ status: string }>>`
        select status
        from growth.sequence_enrollments
        where prospect_id = ${prospectId}
      `;
      assert.equal(enrollment?.status, "pending_approval");

      const [message] = await sql<
        Array<{
          status: string;
          scheduledFor: Date | null;
          providerDraftId: string;
          providerThreadId: string;
        }>
      >`
        select
          status,
          scheduled_for as "scheduledFor",
          provider_draft_id as "providerDraftId",
          provider_thread_id as "providerThreadId"
        from growth.email_messages
        where id = ${result.messageId}
      `;
      assert.equal(message?.status, "provider_draft");
      assert.equal(message?.scheduledFor, null);
      assert.equal(message?.providerDraftId, "provider-draft-1");
      assert.equal(message?.providerThreadId, "provider-thread-1");

      const [draft] = await sql<Array<{ reviewState: string }>>`
        select output_snapshot ->> 'reviewState' as "reviewState"
        from growth.agent_tasks
        where id = ${identity.draftTaskId}
      `;
      assert.equal(draft?.reviewState, "provider_draft");
    } finally {
      await sql`delete from growth.suppressions where normalised_email = ${contactEmail}`;
      await sql`
        update growth.sequence_enrollments
        set first_message_id = null
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.email_messages
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.sequence_enrollments
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.audit_log
        where correlation_id like ${`${externalRunId}%`}
      `;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.website_assessments
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospect_previews
        where prospect_id in (
          select p.id from growth.prospects p
          inner join growth.research_runs rr on rr.id = p.research_run_id
          where rr.external_run_id = ${externalRunId}
        )
      `;
      await sql`
        delete from growth.prospects
        where research_run_id in (
          select id from growth.research_runs where external_run_id = ${externalRunId}
        )
      `;
      await sql`delete from growth.contacts where email = ${contactEmail}`;
      await sql`delete from growth.businesses where company_number = ${companyNumber}`;
      await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
      await sql.end();
    }
  },
);
