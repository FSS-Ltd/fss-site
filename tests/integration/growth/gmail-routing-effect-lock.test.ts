import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "actual Gmail effect holds routing serialization while a sender claim waits",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", ""),
      runA = `effect-lock-a-${token}`,
      runB = `effect-lock-b-${token}`;
    const companyA = `${token.slice(0, 11).toUpperCase()}A`,
      companyB = `${token.slice(0, 11).toUpperCase()}B`;
    const emailA = `effect-lock-a-${token}@example.test`,
      emailB = `effect-lock-b-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const a = await setUpApprovedGmailDraft(sql, runA, companyA, emailA);
      const b = await setUpApprovedGmailDraft(sql, runB, companyB, emailB);
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`update growth.sequence_enrollments set status='active',gmail_thread_id='locked-thread' where id=${a.approved.sequenceEnrollmentId}`;
      await sql`update growth.email_messages set status='queued',provider_draft_id=null,attempt_count=0,scheduled_for=now() where id=${b.approved.messageId}`;
      await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'test-subject',1,${binding.grantedScopes})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${a.approved.messageId},${a.approved.sequenceEnrollmentId},${connectionId},current_date,'accepted',${connectionId},1,${a.approved.rfcMessageId},1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now(),'effect-sent','locked-thread')`;
      const [identity] = await sql<
        Array<{ businessId: string; prospectId: string; contactId: string }>
      >`select p.business_id as "businessId",se.prospect_id as "prospectId",se.contact_id as "contactId" from growth.sequence_enrollments se join growth.prospects p on p.id=se.prospect_id where se.id=${a.approved.sequenceEnrollmentId}`;
      assert.ok(identity);
      const effect =
        Promise.withResolvers<
          Awaited<
            ReturnType<typeof postgresGmailSyncRepository.recordInboundEvent>
          >
        >();
      const claim =
        Promise.withResolvers<
          Awaited<
            ReturnType<
              typeof postgresSequenceDispatchRepository.claimDueMessage
            >
          >
        >();
      async function waitFor(query: string) {
        for (let i = 0; i < 100; i++) {
          const [row] =
            await sql`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='advisory' and query like ${`%${query}%`}) as waiting`;
          if (row?.waiting === true) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.fail(`expected advisory wait for ${query}`);
      }
      await sql.begin(async (holder) => {
        await holder`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`}, 0))`;
        postgresGmailSyncRepository
          .recordInboundEvent(app, {
            binding,
            sequenceEnrollmentId: a.approved.sequenceEnrollmentId,
            prospectId: identity.prospectId,
            contactId: identity.contactId,
            gmailMessageId: `locked-inbound-${token}`,
            gmailThreadId: "locked-thread",
            observation: {
              messageId: `locked-inbound-${token}`,
              historyId: "300",
              fromHeader: "reader@example.test",
              threadId: "locked-thread",
              inReplyTo: null,
              references: null,
              fromAddress: "reader@example.test",
            },
            rfcMessageId: null,
            from: "reader@example.test",
            subject: null,
            receivedAt: new Date(),
            eventType: "reply",
            correlationId: `locked-${token}`,
          })
          .then(effect.resolve, effect.reject);
        await waitFor("hashtextextended($1");
        postgresSequenceDispatchRepository
          .claimDueMessage(app, {
            messageId: b.approved.messageId,
            now: new Date(),
            leaseToken: randomUUID(),
            leaseExpiresAt: new Date(Date.now() + 60000),
          })
          .then(claim.resolve, claim.reject);
        await waitFor("growth:gmail-routing");
      });
      assert.equal((await effect.promise).alreadyRecorded, false);
      assert.equal((await claim.promise)?.id, b.approved.messageId);
      const [row] =
        await sql`select status from growth.sequence_enrollments where id=${a.approved.sequenceEnrollmentId}`;
      assert.equal(row?.status, "stopped_reply");
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
