import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import { createFirstEmailApprover } from "../../../lib/growth/sequences/approval";
import { postgresFirstEmailApprovalRepository } from "../../../lib/growth/sequences/approval-repository";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import { ingestResearchRun } from "../../../lib/growth/research/ingest";
import { createValidResearchRunFixture } from "../../../lib/growth/research/ingestion-schema.test-fixture";

const connectionString = process.env.DIRECT_DATABASE_URL;
const founder = { email: "founder@example.test", actorId: "f".repeat(64) };
const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";

async function setUpApprovedGmailDraft(
  sql: postgres.Sql,
  externalRunId: string,
  companyNumber: string,
  contactEmail: string,
) {
  const fixture = createValidResearchRunFixture();
  fixture.externalRunId = externalRunId;
  const candidate = fixture.prospects[0]!;
  candidate.business.companyNumber = companyNumber;
  candidate.business.googlePlaceId = `place-${companyNumber}`;
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
      createDraft: async () => ({
        draftId: "provider-draft-1",
        messageId: "provider-draft-message-1",
        gmailThreadId: "provider-draft-thread-1",
      }),
    },
    founderEmail: FOUNDER_EMAIL,
    siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
  });
  const approved = await approve(sql, {
    draftTaskId: identity.draftTaskId,
    expectedVersion: 1,
    founder,
    correlationId: `${externalRunId}-approve`,
    sendMode: "gmail_draft",
  });

  return { prospectId, approved };
}

async function cleanUp(
  sql: postgres.Sql,
  externalRunId: string,
  contactEmail: string,
  companyNumber: string,
) {
  await sql`
    update growth.sequence_enrollments set first_message_id = null
    where prospect_id in (
      select p.id from growth.prospects p
      inner join growth.research_runs rr on rr.id = p.research_run_id
      where rr.external_run_id = ${externalRunId}
    )
  `;
  await sql`
    delete from growth.email_events
    where email_message_id in (
      select em.id from growth.email_messages em
      inner join growth.prospects p on p.id = em.prospect_id
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
    delete from growth.prospects
    where research_run_id in (select id from growth.research_runs where external_run_id = ${externalRunId})
  `;
  await sql`delete from growth.contacts where email = ${contactEmail}`;
  await sql`delete from growth.businesses where company_number = ${companyNumber}`;
  await sql`delete from growth.research_runs where external_run_id = ${externalRunId}`;
}

test(
  "reconciling a founder-sent Gmail draft activates the sequence and schedules follow-ups",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-gmail-sync-reconcile-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `gmail-sync-reconcile-${token}@example.test`;

    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        externalRunId,
        companyNumber,
        contactEmail,
      );

      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient: {
          listHistory: async () => ({
            historyId: "200",
            records: [
              {
                historyId: "200",
                messagesAdded: [
                  {
                    messageId: "sent-message-1",
                    gmailThreadId: "provider-draft-thread-1",
                  },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: "sent-message-1",
            gmailThreadId: "provider-draft-thread-1",
            historyId: "200",
            labelIds: ["SENT"],
            receivedAt: new Date().toISOString(),
            from: FOUNDER_EMAIL,
            subject: "A practical idea",
            rfcMessageId: approved.rfcMessageId,
            autoSubmitted: null,
            precedence: null,
            returnPath: null,
            autoResponseSuppress: null,
          }),
          getProfile: async () => ({
            emailAddress: FOUNDER_EMAIL,
            historyId: "50",
          }),
        },
        founderEmail: FOUNDER_EMAIL,
      });

      await sql`
        insert into growth.integration_connections (
          provider, subject_email, status, provider_cursor
        ) values (
          'gmail', ${FOUNDER_EMAIL}, 'connected', '100'
        )
        on conflict (provider, subject_email) do update set provider_cursor = '100'
      `;
      const summary = await sync(sql);

      assert.equal(summary.reconciledDrafts, 1);

      const [enrollment] = await sql<Array<{ status: string }>>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollment?.status, "active");

      const [message] = await sql<
        Array<{
          status: string;
          providerMessageId: string | null;
          sentAt: Date | null;
        }>
      >`
        select status, provider_message_id as "providerMessageId", sent_at as "sentAt"
        from growth.email_messages where id = ${approved.messageId}
      `;
      assert.equal(message?.status, "sent");
      assert.equal(message?.providerMessageId, "sent-message-1");
      assert.ok(message?.sentAt);

      const followUps = await sql<Array<{ stepNumber: number }>>`
        select step_number as "stepNumber" from growth.email_messages
        where sequence_enrollment_id = ${approved.sequenceEnrollmentId} and step_number > 0
        order by step_number
      `;
      assert.deepEqual(
        followUps.map((row) => row.stepNumber),
        [1, 2, 3],
      );
    } finally {
      await cleanUp(sql, externalRunId, contactEmail, companyNumber);
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail' and subject_email = ${FOUNDER_EMAIL}
      `;
      await sql.end();
    }
  },
);

test(
  "an inbound reply on an active thread stops the sequence and cancels pending messages",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-gmail-sync-reply-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `gmail-sync-reply-${token}@example.test`;

    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        externalRunId,
        companyNumber,
        contactEmail,
      );
      await sql`
        update growth.sequence_enrollments
        set status = 'active', gmail_thread_id = 'active-thread-1'
        where id = ${approved.sequenceEnrollmentId}
      `;
      await sql`
        insert into growth.email_messages (
          id, sequence_enrollment_id, prospect_id, contact_id,
          channel, direction, step_number, status, idempotency_key, scheduled_for
        ) values (
          gen_random_uuid(), ${approved.sequenceEnrollmentId},
          (select prospect_id from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}),
          (select contact_id from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}),
          'gmail', 'outbound', 1, 'queued', ${`follow_up:1:${approved.sequenceEnrollmentId}`}, now()
        )
      `;

      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient: {
          listHistory: async () => ({
            historyId: "300",
            records: [
              {
                historyId: "300",
                messagesAdded: [
                  {
                    messageId: "reply-message-1",
                    gmailThreadId: "active-thread-1",
                  },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: "reply-message-1",
            gmailThreadId: "active-thread-1",
            historyId: "300",
            labelIds: ["INBOX"],
            receivedAt: new Date().toISOString(),
            from: "Sam Reader <sam@example.test>",
            subject: "Re: A practical idea",
            rfcMessageId: "<reply-1@example.test>",
            autoSubmitted: null,
            precedence: null,
            returnPath: null,
            autoResponseSuppress: null,
          }),
          getProfile: async () => ({
            emailAddress: FOUNDER_EMAIL,
            historyId: "60",
          }),
        },
        founderEmail: FOUNDER_EMAIL,
      });

      await sql`
        insert into growth.integration_connections (
          provider, subject_email, status, provider_cursor
        ) values (
          'gmail', ${FOUNDER_EMAIL}, 'connected', '100'
        )
        on conflict (provider, subject_email) do update set provider_cursor = '100'
      `;
      const summary = await sync(sql);

      assert.equal(summary.replies, 1);

      const [enrollment] = await sql<Array<{ status: string }>>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollment?.status, "stopped_reply");

      const followUps = await sql<Array<{ status: string }>>`
        select status from growth.email_messages
        where sequence_enrollment_id = ${approved.sequenceEnrollmentId} and step_number = 1
      `;
      assert.equal(followUps[0]?.status, "cancelled");
    } finally {
      await cleanUp(sql, externalRunId, contactEmail, companyNumber);
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail' and subject_email = ${FOUNDER_EMAIL}
      `;
      await sql.end();
    }
  },
);
