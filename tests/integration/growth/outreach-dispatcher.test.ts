import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { createFirstEmailApprover } from "../../../lib/growth/sequences/approval";
import { postgresFirstEmailApprovalRepository } from "../../../lib/growth/sequences/approval-repository";
import { createOutreachDispatcher } from "../../../lib/growth/sequences/dispatcher";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;
const founder = { email: "founder@example.test", actorId: "e".repeat(64) };
const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";

test(
  "two concurrent dispatch claims never process the same due message twice",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 4 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-dispatch-race-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `dispatch-race-${token}@example.test`;

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

      const approve = createFirstEmailApprover({
        repository: postgresFirstEmailApprovalRepository,
        gmailClient: {
          createDraft: async () => {
            throw new Error("not used in this test");
          },
        },
        founderEmail: FOUNDER_EMAIL,
        siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
      });
      const approved = await approve(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        reviewedRecipient: {
          email: contactEmail,
          contactId: identity.contactId,
          contactVersion: identity.contactVersion,
          prospectVersion: identity.prospectVersion,
        },
        founder,
        correlationId: `${externalRunId}-approve`,
        sendMode: "queue",
      });

      const claimResults = await Promise.all([
        postgresSequenceDispatchRepository.claimDueMessage(sql, {
          now: new Date(),
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        }),
        postgresSequenceDispatchRepository.claimDueMessage(sql, {
          now: new Date(),
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        }),
      ]);
      const claimed = claimResults.filter(
        (result) => result?.id === approved.messageId,
      );
      assert.equal(
        claimed.length,
        1,
        "exactly one concurrent worker should claim the due message",
      );

      const [message] = await sql<
        Array<{
          status: string;
          attemptCount: number;
          previousStatus: string | null;
          guarded: boolean;
        }>
      >`
        select status, attempt_count as "attemptCount", outreach_claim_previous_status as "previousStatus", outreach_guarded_claim as guarded
        from growth.email_messages
        where id = ${approved.messageId}
      `;
      assert.equal(message?.status, "sending");
      assert.equal(message?.attemptCount, 0);
      assert.equal(message?.previousStatus, "queued");
      assert.equal(message?.guarded, true);
      await sql`update growth.email_messages set lease_expires_at = now() - interval '1 second' where id = ${approved.messageId}`;
      const reclaimed =
        await postgresSequenceDispatchRepository.claimDueMessage(sql, {
          now: new Date(),
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          messageId: approved.messageId,
        });
      assert.equal(reclaimed?.previousStatus, "sending");
      const [reclaimedMessage] = await sql<{ previousStatus: string | null }[]>`
        select outreach_claim_previous_status as "previousStatus"
        from growth.email_messages where id = ${approved.messageId}
      `;
      assert.equal(reclaimedMessage?.previousStatus, "sending");
    } finally {
      await sql`
        update growth.sequence_enrollments set first_message_id = null
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
      await sql`delete from growth.audit_log where correlation_id like ${`${externalRunId}%`}`;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
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
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
      `;
      await sql`delete from growth.contacts where email = ${contactEmail}`;
      await sql`delete from growth.businesses where company_number = ${companyNumber}`;
      await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
      await sql.end();
    }
  },
);

test(
  "a usage hold preserves approved work and an expired guarded claim is reclaimed",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-dispatch-happy-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `dispatch-happy-${token}@example.test`;

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

      const approve = createFirstEmailApprover({
        repository: postgresFirstEmailApprovalRepository,
        gmailClient: {
          createDraft: async () => {
            throw new Error("not used in this test");
          },
        },
        founderEmail: FOUNDER_EMAIL,
        siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
      });
      const approved = await approve(sql, {
        draftTaskId: identity.draftTaskId,
        expectedVersion: 1,
        reviewedRecipient: {
          email: contactEmail,
          contactId: identity.contactId,
          contactVersion: identity.contactVersion,
          prospectVersion: identity.prospectVersion,
        },
        founder,
        correlationId: `${externalRunId}-approve`,
        sendMode: "queue",
      });

      const dispatchAt = new Date();
      const dispatch = createOutreachDispatcher({
        repository: postgresSequenceDispatchRepository,
        bound:
          {} as import("../../../lib/growth/integrations/gmail/live-client").BoundGmailClient,
        refreshUsage: async () => ({ status: "held", reason: "usage_unknown" }),
        reserve: async () => ({ status: "held", reason: "unused" }),
        submit: async () => ({ status: "held", reason: "unused" }),
        confirm: async () => ({ status: "held", reason: "unused" }),
      });
      const summary = await dispatch(sql, dispatchAt, approved.messageId);
      assert.equal(summary.held, 1);
      const [message] = await sql<{ status: string; sentAt: Date | null }[]>`
        select status,sent_at as "sentAt" from growth.email_messages where id=${approved.messageId}`;
      assert.equal(message?.status, "queued");
      assert.equal(message?.sentAt, null);

      // Historical follow-up fixture for the separate expired-lease claim check.
      await sql`insert into growth.email_messages (id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,scheduled_for)
        values (gen_random_uuid(),${approved.sequenceEnrollmentId},${prospectId},${identity.contactId},'gmail','outbound',1,'queued',${`follow_up:1:${approved.sequenceEnrollmentId}`},${dispatchAt})`;
      // Simulate a crashed worker: force one follow-up into 'sending' with an
      // expired lease, and confirm the dispatcher reclaims it.
      const [followUp] = await sql<Array<{ id: string }>>`
        select id from growth.email_messages
        where prospect_id = ${prospectId} and step_number = 1
      `;
      assert.ok(followUp);
      await sql`
        update growth.email_messages
        set status = 'sending',
            outreach_guarded_claim = true,
            lease_token = ${randomUUID()},
            lease_expires_at = ${new Date(Date.now() - 60_000)},
            scheduled_for = ${new Date(Date.now() - 60_000)}
        where id = ${followUp.id}
      `;

      const reclaimed =
        await postgresSequenceDispatchRepository.claimDueMessage(sql, {
          now: new Date(),
          leaseToken: randomUUID(),
          leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
      assert.equal(reclaimed?.id, followUp.id);
      assert.equal(reclaimed?.previousStatus, "sending");
      assert.equal(reclaimed?.attemptCount, 0);
    } finally {
      await sql`
        update growth.sequence_enrollments set first_message_id = null
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
      await sql`delete from growth.audit_log where correlation_id like ${`${externalRunId}%`}`;
      await sql`
        delete from growth.agent_tasks
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
      `;
      await sql`
        delete from growth.source_evidence
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
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
        where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
      `;
      await sql`delete from growth.contacts where email = ${contactEmail}`;
      await sql`delete from growth.businesses where company_number = ${companyNumber}`;
      await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
      await sql.end();
    }
  },
);
