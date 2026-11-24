import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { recordSent } from "../../../lib/growth/sequences/dispatcher-repository";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import {
  postgresGmailSyncRepository,
  loadReplyCoverage,
} from "../../../lib/growth/sequences/gmail-sync-repository";
import type { GmailRoutingInput } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
  FOUNDER_EMAIL,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "a pending send remains a durable gap when its actual thread writer finishes after a miss",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const run = `routing-race-${token}`,
      company = token.slice(0, 12).toUpperCase(),
      email = `routing-race-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        run,
        company,
        email,
      );
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`update growth.sequence_enrollments set status='active' where id=${approved.sequenceEnrollmentId}`;
      await sql`update growth.email_messages set status='sending',attempt_count=1,provider_draft_id=null where id=${approved.messageId}`;
      const [identity] = await sql<
        Array<{ prospectId: string; contactId: string; rfc: string }>
      >`select se.prospect_id as "prospectId",se.contact_id as "contactId",em.rfc_message_id as rfc from growth.sequence_enrollments se join growth.email_messages em on em.id=se.first_message_id where se.id=${approved.sequenceEnrollmentId}`;
      assert.ok(identity);
      const before = await postgresGmailSyncRepository.findEnrollmentByThread(
        app,
        "late-thread",
        binding,
      );
      assert.equal(before.kind, "none");
      const repository = {
        ...postgresGmailSyncRepository,
        async classifyGmailRouting(db: typeof app, input: GmailRoutingInput) {
          const result = await postgresGmailSyncRepository.classifyGmailRouting(
            db,
            input,
          );
          assert.equal(result.kind, "uncertain");
          await recordSent(app, {
            messageId: approved.messageId,
            sequenceEnrollmentId: approved.sequenceEnrollmentId,
            prospectId: identity.prospectId,
            contactId: identity.contactId,
            providerMessageId: `late-sent-${token}`,
            providerThreadId: "late-thread",
            sentAt: new Date(),
            rfcMessageId: identity.rfc,
            subjectSnapshot: "subject",
            htmlSnapshot: "body",
            textSnapshot: "body",
            followUps: [
              {
                stepNumber: 1,
                scheduledFor: new Date(),
                idempotencyKey: `late-followup-${token}`,
              },
            ],
          });
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
                    messageId: `late-inbound-${token}`,
                    gmailThreadId: "late-thread",
                  },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: `late-inbound-${token}`,
            gmailThreadId: "late-thread",
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
            inReplyTo: null,
            references: null,
          }),
        },
      });
      const summary = await sync(app);
      assert.equal(summary.replies, 0);
      const [inbound] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${`late-inbound-${token}`}`;
      assert.equal(inbound?.count, 0);
      const [pending] =
        await sql`select status from growth.email_messages where idempotency_key=${`late-followup-${token}`}`;
      assert.equal(pending?.status, "queued");
      const [gap] = await sql<
        Array<{ state: string; reason: string; from: Date; until: Date }>
      >`select state,reason,observed_from as "from",observed_until as "until" from growth.gmail_reply_coverage where connection_id=${connectionId} order by observed_until desc limit 1`;
      assert.equal(gap?.state, "gap");
      assert.equal(gap?.reason, "unknown_account_thread");
      assert.ok(gap?.from && gap.until);
      const coverage = await loadReplyCoverage(
        app,
        connectionId,
        "test-subject",
        gap.from,
        gap.until,
      );
      assert.equal(coverage, false);
      const after = await postgresGmailSyncRepository.classifyGmailRouting(
        app,
        {
          binding,
          threadId: "late-thread",
          fromAddress: null,
          inReplyTo: identity.rfc,
          references: null,
        },
      );
      assert.equal(
        after.kind,
        "unknown",
        "a later legacy writer cannot invent account binding",
      );
      await sql`update growth.integration_connections set provider_cursor=null,version=version+1 where id=${connectionId}`;
      const recovered = await postgresGmailSyncRepository.loadReplySyncState(
        app,
        { ...binding, grantEpoch: binding.grantEpoch + 1 },
      );
      assert.equal(recovered.historyCursor, "300");
      assert.equal(
        await loadReplyCoverage(
          app,
          connectionId,
          "test-subject",
          gap.from,
          gap.until,
        ),
        false,
        "reconnect does not resolve the committed gap",
      );
    } finally {
      await cleanUp(sql, run, email, company);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
