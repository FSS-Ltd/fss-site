import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { recordSent } from "../../../lib/growth/sequences/dispatcher-repository";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import type { GmailRoutingInput } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
  FOUNDER_EMAIL,
} from "./gmail-sync-fixtures";

const connectionString = process.env.DIRECT_DATABASE_URL;

test(
  "actual thread writer makes a preliminary match ambiguous before inbound effects",
  { skip: !connectionString },
  async () => {
    if (!connectionString) return;
    const sql = postgres(connectionString, { max: 2 });
    const app = postgres(connectionString, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const runA = `gmail-race-a-${token}`,
      runB = `gmail-race-b-${token}`;
    const companyA = token.slice(0, 11).toUpperCase() + "A",
      companyB = token.slice(0, 11).toUpperCase() + "B";
    const emailA = `race-a-${token}@example.test`,
      emailB = `race-b-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const a = await setUpApprovedGmailDraft(sql, runA, companyA, emailA);
      const b = await setUpApprovedGmailDraft(sql, runB, companyB, emailB);
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'test-subject',1,${binding.grantedScopes})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
      await sql`update growth.sequence_enrollments set status='active', gmail_thread_id='race-thread' where id=${a.approved.sequenceEnrollmentId}`;
      await sql`update growth.sequence_enrollments set status='active' where id=${b.approved.sequenceEnrollmentId}`;
      await sql`insert into growth.email_messages (id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,scheduled_for)
        select gen_random_uuid(), id, prospect_id, contact_id, 'gmail', 'outbound', 1, 'queued', ${`race-followup-${token}`}, now() from growth.sequence_enrollments where id=${a.approved.sequenceEnrollmentId}`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${a.approved.messageId},${a.approved.sequenceEnrollmentId},${connectionId},current_date,'accepted',${connectionId},1,'<race@example.test>',1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now(),'race-sent','race-thread')`;
      const [identity] = await sql<
        Array<{ prospectId: string; contactId: string }>
      >`select prospect_id as "prospectId",contact_id as "contactId" from growth.sequence_enrollments where id=${b.approved.sequenceEnrollmentId}`;
      assert.ok(identity);
      let preliminary = false;
      const repository = {
        ...postgresGmailSyncRepository,
        async classifyGmailRouting(db: typeof app, input: GmailRoutingInput) {
          const result = await postgresGmailSyncRepository.classifyGmailRouting(
            db,
            input,
          );
          const thread = input.threadId;
          assert.equal(result.kind, "unique");
          preliminary = true;
          const writer = Promise.withResolvers<void>();
          await sql.begin(async (holder) => {
            await holder`select pg_advisory_xact_lock(hashtextextended(${`growth:gmail-thread:${thread}`}, 0))`;
            recordSent(app, {
              messageId: b.approved.messageId,
              sequenceEnrollmentId: b.approved.sequenceEnrollmentId,
              prospectId: identity.prospectId,
              contactId: identity.contactId,
              providerMessageId: `writer-${token}`,
              providerThreadId: thread,
              sentAt: new Date(),
              rfcMessageId: `<writer-${token}@example.test>`,
              subjectSnapshot: "subject",
              htmlSnapshot: "body",
              textSnapshot: "body",
              followUps: null,
            }).then(writer.resolve, writer.reject);
            let waiting = false;
            for (let i = 0; i < 100 && !waiting; i++) {
              const [state] =
                await sql`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='advisory' and query like '%pg_advisory_xact_lock%') as waiting`;
              waiting = state?.waiting === true;
              if (!waiting)
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            assert.equal(
              waiting,
              true,
              "actual writer must wait on the shared thread lock",
            );
          });
          await writer.promise;
          return result;
        },
      };
      const sync = createGmailReplySync({
        repository,
        binding,
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
                  {
                    messageId: `race-reply-${token}`,
                    gmailThreadId: "race-thread",
                  },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: `race-reply-${token}`,
            gmailThreadId: "race-thread",
            historyId: "300",
            labelIds: ["INBOX"],
            receivedAt: new Date().toISOString(),
            from: "reader@example.test",
            subject: null,
            rfcMessageId: null,
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
        },
      });
      const result = await sync(app);
      assert.equal(preliminary, true);
      assert.equal(result.replies, 0);
      const rows =
        await sql`select status from growth.sequence_enrollments where id in (${a.approved.sequenceEnrollmentId}, ${b.approved.sequenceEnrollmentId})`;
      assert.deepEqual(rows.map((row) => row.status).sort(), [
        "active",
        "active",
      ]);
      const [inbound] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${`race-reply-${token}`}`;
      assert.equal(inbound?.count, 0);
      const [pending] =
        await sql`select status from growth.email_messages where idempotency_key=${`race-followup-${token}`}`;
      assert.equal(pending?.status, "queued");
      const [audits] =
        await sql`select count(*)::int as count from growth.audit_log where entity_id=${a.approved.sequenceEnrollmentId} and action like 'sequence.stopped.%'`;
      assert.equal(audits?.count, 0);
      const [gap] =
        await sql`select state, reason from growth.gmail_reply_coverage where connection_id=${connectionId} order by observed_until desc limit 1`;
      assert.equal(gap?.state, "gap");
      assert.equal(gap?.reason, "ambiguous_account_thread");
    } finally {
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
      await cleanUp(sql, runA, emailA, companyA);
      await cleanUp(sql, runB, emailB, companyB);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
