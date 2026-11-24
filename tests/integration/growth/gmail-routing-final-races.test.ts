import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import { postgresSequenceDispatchRepository } from "../../../lib/growth/sequences/dispatcher-repository";
import type { GmailRoutingInput } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
  FOUNDER_EMAIL,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
for (const scenario of ["new-reference", "new-exposure"] as const) {
  test(
    `final Gmail effect rechecks an actual ${scenario} writer`,
    { skip: !url },
    async () => {
      if (!url) return;
      const sql = postgres(url, { max: 2 });
      const app = postgres(url, {
        max: 2,
        connection: { options: "-c role=growth_app" },
      });
      const writer = postgres(url, {
        max: 1,
        connection: { options: "-c role=growth_app" },
      });
      const token = randomUUID().replaceAll("-", ""),
        runA = `final-a-${token}`,
        runB = `final-b-${token}`;
      const companyA = `${token.slice(0, 11).toUpperCase()}A`,
        companyB = `${token.slice(0, 11).toUpperCase()}B`;
      const emailA = `final-a-${token}@example.test`,
        emailB = `final-b-${token}@example.test`;
      const connectionId = randomUUID(),
        futureMessageId = randomUUID();
      let bCreated = false;
      try {
        const a = await setUpApprovedGmailDraft(sql, runA, companyA, emailA);
        const binding = await setUpBoundBaseline(sql, connectionId);
        await sql`update growth.sequence_enrollments set status='active',gmail_thread_id='effect-thread' where id=${a.approved.sequenceEnrollmentId}`;
        await sql`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) select gen_random_uuid(),id,prospect_id,contact_id,'gmail','outbound',1,'queued',${`effect-pending-${token}`} from growth.sequence_enrollments where id=${a.approved.sequenceEnrollmentId}`;
        if (scenario === "new-reference") {
          await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'test-subject',1,${binding.grantedScopes})`;
          await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
          await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at,provider_message_id,provider_thread_id) values (${randomUUID()},${a.approved.messageId},${a.approved.sequenceEnrollmentId},${connectionId},current_date,'accepted',${connectionId},1,${a.approved.rfcMessageId},1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now(),'bound-sent','effect-thread')`;
        }
        let b: Awaited<ReturnType<typeof setUpApprovedGmailDraft>> | undefined;
        if (scenario === "new-exposure") {
          bCreated = true;
          b = await setUpApprovedGmailDraft(sql, runB, companyB, emailB);
          await sql`update growth.email_messages set status='queued',provider_draft_id=null,attempt_count=0,scheduled_for=now() where id=${b.approved.messageId}`;
        }
        const reference =
          scenario === "new-reference"
            ? `<growthos.${futureMessageId}@faithfulsoftware.dev>`
            : null;
        const repository = {
          ...postgresGmailSyncRepository,
          async classifyGmailRouting(db: typeof app, input: GmailRoutingInput) {
            const preliminary =
              await postgresGmailSyncRepository.classifyGmailRouting(db, input);
            assert.equal(
              preliminary.kind,
              scenario === "new-reference" ? "unique" : "unknown",
            );
            if (scenario === "new-exposure") {
              assert.equal(preliminary.kind, "unknown");
              if (preliminary.kind !== "unknown")
                throw new Error("Expected an unbound candidate.");
              assert.equal(preliminary.safeToPause, true);
            }
            if (scenario === "new-exposure") {
              assert.ok(b);
              const claimed =
                await postgresSequenceDispatchRepository.claimDueMessage(
                  writer,
                  {
                    now: new Date(),
                    leaseToken: randomUUID(),
                    leaseExpiresAt: new Date(Date.now() + 60000),
                    messageId: b.approved.messageId,
                  },
                );
              assert.equal(claimed?.id, b.approved.messageId);
            } else {
              bCreated = true;
              await setUpApprovedGmailDraft(
                writer,
                runB,
                companyB,
                emailB,
                undefined,
                futureMessageId,
              );
            }
            return preliminary;
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
                      messageId: `effect-${token}`,
                      gmailThreadId: "effect-thread",
                    },
                  ],
                  messagesDeleted: [],
                },
              ],
            }),
            getMessageMetadata: async () => ({
              messageId: `effect-${token}`,
              gmailThreadId: "effect-thread",
              historyId: "300",
              labelIds: ["INBOX"],
              receivedAt: new Date().toISOString(),
              from: "changed-sender@example.test",
              subject: null,
              rfcMessageId: null,
              autoSubmitted: null,
              precedence: null,
              returnPath: null,
              autoResponseSuppress: null,
              to: null,
              cc: null,
              bcc: null,
              inReplyTo: reference,
              references: null,
            }),
          },
        });
        const result = await sync(app);
        assert.equal(result.replies, 0);
        const [state] =
          await sql`select se.status, em.status as pending from growth.sequence_enrollments se join growth.email_messages em on em.sequence_enrollment_id=se.id and em.idempotency_key=${`effect-pending-${token}`} where se.id=${a.approved.sequenceEnrollmentId}`;
        assert.equal(state?.status, "active");
        assert.equal(state?.pending, "queued");
        const [inbound] =
          await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${`effect-${token}`}`;
        const [audit] =
          await sql`select count(*)::int as count from growth.audit_log where entity_id=${a.approved.sequenceEnrollmentId} and action like 'sequence.stopped.%'`;
        const [suppression] =
          await sql`select count(*)::int as count from growth.suppressions where normalised_email=${emailA}`;
        assert.equal(inbound?.count, 0);
        assert.equal(audit?.count, 0);
        assert.equal(suppression?.count, 0);
        const [gap] =
          await sql`select state,reason from growth.gmail_reply_coverage where connection_id=${connectionId} order by observed_until desc limit 1`;
        assert.equal(gap?.state, "gap");
        assert.equal(
          gap?.reason,
          scenario === "new-reference"
            ? "ambiguous_account_thread"
            : "unknown_account_thread",
        );
      } finally {
        await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
        await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
        await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
        await cleanUp(sql, runA, emailA, companyA);
        if (bCreated) await cleanUp(sql, runB, emailB, companyB);
        await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
        await sql`delete from growth.integration_connections where id=${connectionId}`;
        await app.end();
        await writer.end();
        await sql.end();
      }
    },
  );
}
