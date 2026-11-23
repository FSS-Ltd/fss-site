import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "routing clears only when every actual attempt has non-invocation evidence",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", ""),
      run = `noninvoke-${token}`,
      company = token.slice(0, 12).toUpperCase(),
      email = `noninvoke-${token}@example.test`,
      connection = randomUUID(),
      reservation = randomUUID(),
      old = randomUUID();
    try {
      const fixture = await setUpApprovedGmailDraft(sql, run, company, email);
      const binding = await setUpBoundBaseline(sql, connection);
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connection},${connection},false,'unknown')`;
      const message = fixture.approved.messageId,
        sequence = fixture.approved.sequenceEnrollmentId,
        rfc = fixture.approved.rfcMessageId,
        hash = "a".repeat(64);
      await sql`update growth.email_messages set status='sending',attempt_count=1,provider_draft_id=null where id=${message}`;
      await sql`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until) values (${reservation},${randomUUID()},${message},${sequence},${connection},current_date,${connection},1,${rfc},1,${hash},${randomUUID()},now()+interval '5 minutes')`;
      const snapshot = {
        version: 1,
        kind: "direct_raw",
        raw: "YQ",
        rawSha256: hash,
        from: "j.ntagengwa@faithfulsoftware.dev",
        connectionId: connection,
        googleSubject: "test-subject",
        grantEpoch: 1,
        rfcMessageId: rfc,
        messageId: message,
        sequenceId: sequence,
        membershipId: null,
        envelope: { to: [email], cc: [], bcc: [] },
      };
      await sql`update growth.outreach_reservations set status='submitting',submitted_at=now(),issued_snapshot=${sql.json(snapshot)},issued_snapshot_hash=${hash} where id=${reservation}`;
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`update growth.outreach_reservations set status='rejected',direct_noninvocation_evidence=${tx.json({ version: 1, kind: "gmail_send_not_invoked_v1", reservationId: reservation, reason: null })} where id=${reservation}`;
          throw new Error("malformed marker accepted");
        }),
        /direct_noninvocation_identity/,
      );
      await sql`update growth.outreach_reservations set status='rejected',direct_noninvocation_evidence=${sql.json({ version: 1, kind: "gmail_send_not_invoked_v1", reservationId: reservation, reason: "guard_rejected" })} where id=${reservation}`;
      const classify = () =>
        classifyGmailRouting(app, {
          binding,
          threadId: "unrelated-thread",
          inReplyTo: null,
          references: null,
          fromAddress: email,
        });
      assert.deepEqual(await classify(), { kind: "none" });
      await sql`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${old},${randomUUID()},${message},${sequence},${connection},current_date,'rejected',${connection},1,${rfc},1,${hash},${randomUUID()},now()+interval '5 minutes',now())`;
      await sql`update growth.email_messages set attempt_count=2 where id=${message}`;
      assert.deepEqual(await classify(), { kind: "uncertain" });
    } finally {
      await sql`delete from growth.outreach_reservations where id in (${reservation},${old})`;
      await cleanUp(sql, run, email, company);
      await sql`delete from growth.outreach_provider_usage where account_id=${connection}`;
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connection}`;
      await sql`delete from growth.integration_connections where id=${connection}`;
      await app.end();
      await sql.end();
    }
  },
);
