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
for (const scenario of [
  "response-lost",
  "provider-failure",
  "persistence-failure",
] as const) {
  test(
    `a draft creation ${scenario} holds changed-sender no-match observations`,
    { skip: !url },
    async () => {
      if (!url) return;
      const sql = postgres(url, { max: 2 });
      const app = postgres(url, {
        max: 2,
        connection: { options: "-c role=growth_app" },
      });
      const token = randomUUID().replaceAll("-", ""),
        run = `draft-loss-${token}`,
        company = token.slice(0, 12).toUpperCase(),
        email = `draft-loss-${token}@example.test`;
      const connectionId = randomUUID();
      try {
        let providerCreated = false;
        let routingLockAvailable = false;
        await assert.rejects(
          setUpApprovedGmailDraft(
            app,
            run,
            company,
            email,
            async () => {
              const [probe] =
                await sql`select pg_try_advisory_xact_lock(hashtextextended('growth:gmail-routing', 0)) as available`;
              routingLockAvailable = probe?.available === true;
              providerCreated = scenario !== "provider-failure";
              if (scenario === "persistence-failure")
                return {
                  draftId: "synthetic",
                  messageId: "synthetic",
                  gmailThreadId: "synthetic",
                };
              throw new Error("synthetic provider error");
            },
            undefined,
            scenario === "persistence-failure",
          ),
        );
        assert.equal(providerCreated, scenario !== "provider-failure");
        assert.equal(
          routingLockAvailable,
          true,
          "provider callback runs after the routing transaction releases its lock",
        );
        const [draft] = await sql<
          Array<{
            id: string;
            sequenceId: string;
            status: string;
            providerDraftId: string | null;
            attemptCount: number;
          }>
        >`
      select em.id,em.sequence_enrollment_id as "sequenceId",em.status,em.provider_draft_id as "providerDraftId",em.attempt_count as "attemptCount"
      from growth.email_messages em join growth.prospects p on p.id=em.prospect_id join growth.research_runs rr on rr.id=p.research_run_id where rr.external_run_id=${run}`;
        assert.ok(draft);
        assert.equal(draft.status, "draft");
        assert.equal(draft.providerDraftId, null);
        assert.equal(draft.attemptCount, 0);
        const binding = await setUpBoundBaseline(sql, connectionId);
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
                      messageId: `missing-${token}`,
                      gmailThreadId: "missing-thread",
                    },
                    {
                      messageId: `other-${token}`,
                      gmailThreadId: "other-thread",
                    },
                  ],
                  messagesDeleted: [],
                },
              ],
            }),
            getMessageMetadata: async (messageId) => ({
              messageId,
              gmailThreadId: messageId.startsWith("missing-")
                ? "missing-thread"
                : "other-thread",
              historyId: "300",
              labelIds: ["INBOX"],
              receivedAt: new Date().toISOString(),
              from: "changed-person@example.test",
              subject: null,
              rfcMessageId: null,
              autoSubmitted: null,
              precedence: null,
              returnPath: null,
              autoResponseSuppress: null,
              to: null,
              cc: null,
              bcc: null,
              inReplyTo: messageId.startsWith("missing-")
                ? null
                : "<not-ours@example.test>",
              references: null,
            }),
          },
        });
        const summary = await sync(app);
        assert.equal(summary.replies, 0);
        const [state] =
          await sql`select status from growth.sequence_enrollments where id=${draft.sequenceId}`;
        assert.equal(state?.status, "pending_approval");
        const [message] =
          await sql`select status from growth.email_messages where id=${draft.id}`;
        assert.equal(message?.status, "draft");
        const [inbound] =
          await sql`select count(*)::int as count from growth.email_messages where provider_message_id in (${`missing-${token}`},${`other-${token}`})`;
        assert.equal(inbound?.count, 0);
        const [gap] =
          await sql`select state,reason,unknown_observations from growth.gmail_reply_coverage where connection_id=${connectionId} order by observed_until desc limit 1`;
        assert.equal(gap?.state, "gap");
        assert.equal(gap?.reason, "unknown_account_thread");
        assert.equal(gap?.unknown_observations.length, 2);
        const [audit] =
          await sql`select count(*)::int as count from growth.audit_log where entity_id=${draft.sequenceId} and action like 'sequence.stopped.%'`;
        assert.equal(audit?.count, 0);
        const [suppressions] =
          await sql`select count(*)::int as count from growth.suppressions where normalised_email=${email}`;
        assert.equal(suppressions?.count, 0);
      } finally {
        await cleanUp(sql, run, email, company);
        await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
        await sql`delete from growth.integration_connections where id=${connectionId}`;
        await app.end();
        await sql.end();
      }
    },
  );
}
