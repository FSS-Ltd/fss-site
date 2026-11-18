import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import postgres from "postgres";

import {
  stopSequence,
  type GmailSyncActor,
} from "../../../lib/growth/sequences/stop";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";

const connectionString = process.env.DIRECT_DATABASE_URL;
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
  FOUNDER_EMAIL,
} from "./gmail-sync-fixtures";

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
      // Deliberately bypass TypeScript to exercise the runtime trust boundary.
      const malformedActor = {
        type: "gmail_sync",
        id: "gmail-sync",
      } as GmailSyncActor;
      await assert.rejects(
        stopSequence(app, {
          sequenceId: approved.sequenceEnrollmentId,
          reason: "bounce",
          actor: malformedActor,
          correlationId: `${externalRunId}-malformed`,
        }),
        TypeError,
      );

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
      const preliminary =
        await postgresGmailSyncRepository.findEnrollmentByThread(
          app,
          "active-thread-1",
          binding,
        );
      assert.equal(preliminary.kind, "unknown");
      await sql`update growth.sequence_enrollments set gmail_thread_id='changed-thread' where id=${approved.sequenceEnrollmentId}`;
      await assert.rejects(
        stopSequence(app, {
          sequenceId: approved.sequenceEnrollmentId,
          reason: "pause",
          actor: { type: "gmail_sync", id: "gmail-sync", binding },
          gmailThreadId: "active-thread-1",
          correlationId: `${externalRunId}-stale`,
        }),
        /attribution changed/,
      );
      const [unchanged] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      assert.equal(unchanged?.status, "active");
      const [pending] =
        await sql`select status from growth.email_messages where sequence_enrollment_id=${approved.sequenceEnrollmentId} and step_number=1`;
      assert.equal(pending?.status, "queued");
      await sql`update growth.sequence_enrollments set gmail_thread_id='active-thread-1' where id=${approved.sequenceEnrollmentId}`;
      const unbound = await postgresGmailSyncRepository.findEnrollmentByThread(
        app,
        "active-thread-1",
        binding,
      );
      assert.equal(unbound.kind, "unknown");
      await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'another-subject',1,${binding.grantedScopes})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${approved.messageId},${approved.sequenceEnrollmentId},${connectionId},current_date,'accepted',${connectionId},1,'<different-subject@example.test>',1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now(),'different-subject-sent','active-thread-1')`;
      await assert.rejects(
        stopSequence(app, {
          sequenceId: approved.sequenceEnrollmentId,
          reason: "pause",
          actor: { type: "gmail_sync", id: "gmail-sync", binding },
          gmailThreadId: "active-thread-1",
          correlationId: `${externalRunId}-contradictory`,
        }),
        /attribution changed/,
      );
      const [stillActive] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      assert.equal(stillActive?.status, "active");
      const [stillQueued] =
        await sql`select status from growth.email_messages where sequence_enrollment_id=${approved.sequenceEnrollmentId} and step_number=1`;
      assert.equal(stillQueued?.status, "queued");
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
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
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
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
      await sql`update growth.integration_connections set granted_scopes=${["openid", "email"]} where id=${connectionId}`;
      await assert.rejects(
        postgresGmailSyncRepository.recordInboundEvent(app, input),
        /grant changed/i,
      );
      await sql`update growth.integration_connections set granted_scopes=${binding.grantedScopes} where id=${connectionId}`;
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
      assert.equal(
        (await postgresGmailSyncRepository.recordInboundEvent(app, input))
          .attributionUnknown,
        true,
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
