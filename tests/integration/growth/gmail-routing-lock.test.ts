import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { recordSent } from "../../../lib/growth/sequences/dispatcher-repository";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "classifier holds the observed thread while an actual writer waits",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", ""),
      run = `routing-lock-${token}`,
      company = token.slice(0, 12).toUpperCase(),
      email = `routing-lock-${token}@example.test`;
    const connectionId = randomUUID();
    try {
      const { approved } = await setUpApprovedGmailDraft(
        sql,
        run,
        company,
        email,
      );
      const binding = await setUpBoundBaseline(sql, connectionId);
      await sql`update growth.email_messages set status='sending',attempt_count=1,provider_draft_id=null where id=${approved.messageId}`;
      const [identity] = await sql<
        Array<{ prospectId: string; contactId: string; rfc: string }>
      >`select se.prospect_id as "prospectId",se.contact_id as "contactId",em.rfc_message_id as rfc from growth.sequence_enrollments se join growth.email_messages em on em.id=se.first_message_id where se.id=${approved.sequenceEnrollmentId}`;
      assert.ok(identity);
      const classified =
        Promise.withResolvers<
          Awaited<ReturnType<typeof classifyGmailRouting>>
        >();
      const written = Promise.withResolvers<void>();
      async function waitForLock(event: string, queryFragment: string) {
        for (let i = 0; i < 100; i++) {
          const [state] =
            await sql`select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event=${event} and query like ${`%${queryFragment}%`}) as waiting`;
          if (state?.waiting === true) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.fail(`expected actual ${event} lock wait`);
      }
      await sql.begin(async (holder) => {
        await holder`select id from growth.integration_connections where id=${connectionId} for update`;
        classifyGmailRouting(app, {
          binding,
          threadId: "barrier-thread",
          inReplyTo: null,
          references: null,
          fromAddress: null,
        }).then(classified.resolve, classified.reject);
        await waitForLock("transactionid", "google_subject");
        recordSent(app, {
          messageId: approved.messageId,
          sequenceEnrollmentId: approved.sequenceEnrollmentId,
          prospectId: identity.prospectId,
          contactId: identity.contactId,
          providerMessageId: `barrier-sent-${token}`,
          providerThreadId: "barrier-thread",
          sentAt: new Date(),
          rfcMessageId: identity.rfc,
          subjectSnapshot: "subject",
          htmlSnapshot: "body",
          textSnapshot: "body",
          followUps: null,
        }).then(written.resolve, written.reject);
        await waitForLock("advisory", "pg_advisory_xact_lock");
      });
      assert.equal((await classified.promise).kind, "uncertain");
      await written.promise;
      const [row] =
        await sql`select gmail_thread_id from growth.sequence_enrollments where id=${approved.sequenceEnrollmentId}`;
      assert.equal(row?.gmail_thread_id, "barrier-thread");
    } finally {
      await cleanUp(sql, run, email, company);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
