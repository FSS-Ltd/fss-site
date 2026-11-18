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

async function setUpBoundBaseline(sql: postgres.Sql, connectionId: string) {
  const at = new Date("2026-01-01T00:00:00Z");
  await sql`insert into growth.integration_connections(id,provider,subject_email,status,provider_cursor,google_subject,granted_scopes) values (${connectionId},'gmail',${FOUNDER_EMAIL},'connected','100','test-subject',${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
  await sql`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_end,observed_until,head_requested_at,head_responded_at,state,reason) values (${connectionId},1,'test-subject','100',${at},${at},${at},'gap','initial_history_unknown')`;
  return {
    connectionId,
    googleSubject: "test-subject",
    grantEpoch: 1,
    grantedScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  };
}

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
}

test(
  "unbound Gmail draft observation does not activate a sequence or create follow-ups",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const app = postgres(connectionString, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const connectionId = randomUUID();
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

      const binding = await setUpBoundBaseline(sql, connectionId);
      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding,
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
            to: null,
            cc: null,
            bcc: null,
            inReplyTo: null,
            references: null,
          }),
          getProfile: async () => ({
            emailAddress: FOUNDER_EMAIL,
            historyId: "200",
          }),
        },
        founderEmail: FOUNDER_EMAIL,
      });

      const summary = await sync(app);

      assert.equal(summary.reconciledDrafts, 0);

      const [enrollment] = await sql<Array<{ status: string }>>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollment?.status, "pending_approval");

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
      assert.equal(message?.status, "provider_draft");
      assert.notEqual(message?.providerMessageId, "sent-message-1");
      assert.equal(message?.sentAt, null);

      const followUps = await sql<Array<{ stepNumber: number }>>`
        select step_number as "stepNumber" from growth.email_messages
        where sequence_enrollment_id = ${approved.sequenceEnrollmentId} and step_number > 0
        order by step_number
      `;
      assert.deepEqual(
        followUps.map((row) => row.stepNumber),
        [],
      );
    } finally {
      await cleanUp(sql, externalRunId, contactEmail, companyNumber);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail' and subject_email = ${FOUNDER_EMAIL}
      `;
      await app.end();
      await sql.end();
    }
  },
);

test(
  "an unbound inbound thread pauses the sequence and cancels pending messages",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;

    const sql = postgres(connectionString, { max: 2 });
    const app = postgres(connectionString, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const connectionId = randomUUID();
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

      const binding = await setUpBoundBaseline(sql, connectionId);
      let revokeDuringRead = true;
      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding,
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
          getMessageMetadata: async () => {
            if (revokeDuringRead)
              await sql`update growth.integration_connections set status='revoked',version=version+1 where id=${connectionId}`;
            return {
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
              to: null,
              cc: null,
              bcc: null,
              inReplyTo: null,
              references: null,
            };
          },
          getProfile: async () => ({
            emailAddress: FOUNDER_EMAIL,
            historyId: "300",
          }),
        },
        founderEmail: FOUNDER_EMAIL,
      });

      await assert.rejects(sync(app), /grant changed/i);
      const [afterRevocation] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      const [cursorAfterRevocation] =
        await sql`select provider_cursor from growth.integration_connections where id=${connectionId}`;
      const [coverageAfterRevocation] =
        await sql`select count(*)::int as count from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      const [inboundAfterRevocation] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id='reply-message-1'`;
      assert.equal(afterRevocation?.status, "active");
      assert.equal(cursorAfterRevocation?.provider_cursor, "100");
      assert.equal(coverageAfterRevocation?.count, 1);
      assert.equal(inboundAfterRevocation?.count, 0);
      await sql`update growth.integration_connections set status='connected',version=1 where id=${connectionId}`;
      revokeDuringRead = false;
      const summary = await sync(app);

      assert.equal(summary.replies, 0);

      const [enrollment] = await sql<Array<{ status: string }>>`
        select status from growth.sequence_enrollments where id = ${approved.sequenceEnrollmentId}
      `;
      assert.equal(enrollment?.status, "paused");

      const followUps = await sql<Array<{ status: string }>>`
        select status from growth.email_messages
        where sequence_enrollment_id = ${approved.sequenceEnrollmentId} and step_number = 1
      `;
      assert.equal(followUps[0]?.status, "cancelled");
    } finally {
      await cleanUp(sql, externalRunId, contactEmail, companyNumber);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`
        delete from growth.integration_connections
        where provider = 'gmail' and subject_email = ${FOUNDER_EMAIL}
      `;
      await app.end();
      await sql.end();
    }
  },
);

test(
  "inbound insertion and stop roll back together if stop audit fails",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const sql = postgres(connectionString, { max: 2 });
    const app = postgres(connectionString, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const externalRunId = `integration-gmail-atomic-${token}`;
    const companyNumber = token.slice(0, 12).toUpperCase();
    const contactEmail = `gmail-atomic-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        externalRunId,
        companyNumber,
        contactEmail,
      );
      await sql`update growth.sequence_enrollments set status='active',gmail_thread_id='thread' where id=${approved.sequenceEnrollmentId}`;
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'test-subject',1,${["openid", "email", "https://www.googleapis.com/auth/gmail.modify"]})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id)
      values (${randomUUID()},${approved.messageId},${approved.sequenceEnrollmentId},${connectionId},current_date,'accepted',${connectionId},1,'<test@example.test>',1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now(),'sent-test','thread')`;

      const [identity] = await sql<
        Array<{ prospectId: string; contactId: string }>
      >`select prospect_id as "prospectId", contact_id as "contactId" from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      assert.ok(identity);
      const matched = await postgresGmailSyncRepository.findEnrollmentByThread(
        app,
        "thread",
        binding,
      );
      assert.equal(matched.kind, "unique");
      const input = {
        binding,
        sequenceEnrollmentId: approved.sequenceEnrollmentId,
        prospectId: identity.prospectId,
        contactId: identity.contactId,
        gmailMessageId: `atomic-${token}`,
        gmailThreadId: "thread",
        rfcMessageId: null,
        from: null,
        subject: null,
        receivedAt: new Date(),
        eventType: "reply" as const,
        correlationId: `atomic-${token}`,
      };
      await sql`update growth.integration_connections set status='revoked',version=version+1 where id=${connectionId}`;
      await assert.rejects(
        postgresGmailSyncRepository.recordInboundEvent(app, input),
        /grant changed/i,
      );
      const [revokedState] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      const [revokedInbound] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${input.gmailMessageId}`;
      assert.equal(revokedState?.status, "active");
      assert.equal(revokedInbound?.count, 0);
      await sql`update growth.integration_connections set status='connected',version=1 where id=${connectionId}`;
      await sql`update growth.outreach_account_controls set verified_subject='different-subject' where connection_id=${connectionId}`;
      assert.equal(
        (
          await postgresGmailSyncRepository.findEnrollmentByThread(
            app,
            "thread",
            binding,
          )
        ).kind,
        "unknown",
      );
      await assert.rejects(
        postgresGmailSyncRepository.recordInboundEvent(app, input),
        /attribution/i,
      );
      await sql`update growth.outreach_account_controls set verified_subject='test-subject' where connection_id=${connectionId}`;
      await sql`create function growth.test_reject_gmail_stop_audit() returns trigger language plpgsql as $$ begin if new.action='sequence.stopped.reply' then raise exception 'injected stop failure'; end if; return new; end $$`;
      await sql`create trigger test_reject_gmail_stop_audit before insert on growth.audit_log for each row execute function growth.test_reject_gmail_stop_audit()`;
      try {
        await assert.rejects(
          postgresGmailSyncRepository.recordInboundEvent(app, input),
          /injected stop failure/,
        );
        const [state] =
          await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
        const [inbound] =
          await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${input.gmailMessageId}`;
        assert.equal(state?.status, "active");
        assert.equal(inbound?.count, 0);
      } finally {
        await sql`drop trigger test_reject_gmail_stop_audit on growth.audit_log`;
        await sql`drop function growth.test_reject_gmail_stop_audit()`;
      }
      await sql`update growth.integration_connections set provider_cursor=null,version=2 where id=${connectionId}`;
      const newBinding = { ...binding, grantEpoch: 2 };
      const recover = createGmailReplySync({
        repository: postgresGmailSyncRepository,
        binding: newBinding,
        founderEmail: FOUNDER_EMAIL,
        gmailClient: {
          getProfile: async () => ({
            emailAddress: FOUNDER_EMAIL,
            historyId: "300",
          }),
          listHistory: async () => ({
            historyId: "300",
            records: [
              {
                historyId: "300",
                messagesAdded: [
                  { messageId: input.gmailMessageId, gmailThreadId: "thread" },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: input.gmailMessageId,
            gmailThreadId: "thread",
            historyId: "300",
            labelIds: ["INBOX"],
            receivedAt: input.receivedAt.toISOString(),
            from: "person@example.test",
            to: null,
            cc: null,
            bcc: null,
            inReplyTo: null,
            references: null,
            subject: null,
            rfcMessageId: null,
            autoSubmitted: null,
            precedence: null,
            returnPath: null,
            autoResponseSuppress: null,
          }),
        },
      });
      await recover(app);
      const [recovery] =
        await sql`select state,grant_epoch,history_start,history_end from growth.gmail_reply_coverage where connection_id=${connectionId} and grant_epoch=2`;
      assert.equal(recovery?.state, "complete");
      assert.equal(recovery?.history_start, "100");
      assert.equal(recovery?.history_end, "300");
      const [state] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      const [inbound] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${input.gmailMessageId}`;
      assert.equal(state?.status, "stopped_reply");
      assert.equal(inbound?.count, 1);
    } finally {
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
      await cleanUp(sql, externalRunId, contactEmail, companyNumber);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
