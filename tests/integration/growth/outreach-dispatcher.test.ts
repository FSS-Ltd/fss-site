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
      const [identity] = await sql<Array<{ draftTaskId: string }>>`
        select at.id as "draftTaskId"
        from growth.agent_tasks at
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
        Array<{ status: string; attemptCount: number }>
      >`
        select status, attempt_count as "attemptCount"
        from growth.email_messages
        where id = ${approved.messageId}
      `;
      assert.equal(message?.status, "sending");
      assert.equal(message?.attemptCount, 1);
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
  "dispatching an approved queue sends the first email and schedules its follow-ups, then reclaims an expired lease",
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
      const [identity] = await sql<Array<{ draftTaskId: string }>>`
        select at.id as "draftTaskId"
        from growth.agent_tasks at
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
        founder,
        correlationId: `${externalRunId}-approve`,
        sendMode: "queue",
      });

      const dispatchAt = new Date();
      const dispatch = createOutreachDispatcher({
        repository: postgresSequenceDispatchRepository,
        gmailClient: {
          sendMessage: async () => ({
            messageId: "provider-message-1",
            gmailThreadId: "provider-thread-1",
          }),
          findByRfcMessageId: async () => null,
        },
        founderEmail: FOUNDER_EMAIL,
        now: () => dispatchAt,
      });

      const summary = await dispatch(sql, dispatchAt);
      assert.equal(summary.claimed, 1);
      assert.equal(summary.sent, 1);

      const [message] = await sql<
        Array<{
          status: string;
          sentAt: Date | null;
          providerMessageId: string | null;
        }>
      >`
        select status, sent_at as "sentAt", provider_message_id as "providerMessageId"
        from growth.email_messages
        where id = ${approved.messageId}
      `;
      assert.equal(message?.status, "sent");
      assert.ok(message?.sentAt);
      assert.equal(message?.providerMessageId, "provider-message-1");

      const followUps = await sql<
        Array<{ stepNumber: number; status: string }>
      >`
        select step_number as "stepNumber", status
        from growth.email_messages
        where prospect_id = ${prospectId} and step_number > 0
        order by step_number
      `;
      assert.deepEqual(
        followUps.map((row) => row.stepNumber),
        [1, 2, 3],
      );
      assert.ok(followUps.every((row) => row.status === "queued"));

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
      assert.equal(reclaimed?.attemptCount, 1);
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
