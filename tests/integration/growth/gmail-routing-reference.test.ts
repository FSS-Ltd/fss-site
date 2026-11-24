import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { createGmailReplySync } from "../../../lib/growth/sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
  FOUNDER_EMAIL,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "an exact legacy reference without account/thread binding persists an unknown gap",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const run = `reference-gap-${token}`,
      company = token.slice(0, 12).toUpperCase(),
      email = `reference-gap-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        run,
        company,
        email,
      );
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`update growth.email_messages set status='queued',attempt_count=0,provider_draft_id=null where id=${approved.messageId}`;
      await sql`update growth.sequence_enrollments set status='active' where id=${approved.sequenceEnrollmentId}`;
      const [outbound] = await sql<
        Array<{ rfc: string }>
      >`select rfc_message_id as rfc from growth.email_messages where id=${approved.messageId}`;
      assert.ok(outbound?.rfc);
      const sync = createGmailReplySync({
        repository: postgresGmailSyncRepository,
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
                    messageId: `reference-inbound-${token}`,
                    gmailThreadId: "unbound-thread",
                  },
                ],
                messagesDeleted: [],
              },
            ],
          }),
          getMessageMetadata: async () => ({
            messageId: `reference-inbound-${token}`,
            gmailThreadId: "unbound-thread",
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
            inReplyTo: outbound.rfc,
            references: null,
          }),
        },
      });
      assert.equal((await sync(app)).replies, 0);
      const [message] =
        await sql`select status from growth.email_messages where id=${approved.messageId}`;
      const [enrollment] =
        await sql`select status from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      assert.equal(message?.status, "queued");
      assert.equal(enrollment?.status, "active");
      const [inbound] =
        await sql`select count(*)::int as count from growth.email_messages where provider_message_id=${`reference-inbound-${token}`}`;
      assert.equal(inbound?.count, 0);
      const [gap] =
        await sql`select state,reason from growth.gmail_reply_coverage where connection_id=${connectionId} order by observed_until desc limit 1`;
      assert.equal(gap?.state, "gap");
      assert.equal(gap?.reason, "unknown_account_thread");
    } finally {
      await cleanUp(sql, run, email, company);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
