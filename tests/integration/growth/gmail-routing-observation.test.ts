import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import type { GmailRoutingInput } from "../../../lib/growth/sequences/gmail-routing-repository";
import {
  cleanUp,
  setUpApprovedGmailDraft,
  setUpBoundBaseline,
} from "./gmail-sync-fixtures";

const url = process.env.DIRECT_DATABASE_URL;

test(
  "actual routing evidence keeps pending, draft, failed and contradictory references uncertain",
  { skip: !url },
  async () => {
    if (!url) return;
    const sql = postgres(url, { max: 2 });
    const app = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const token = randomUUID().replaceAll("-", "");
    const runA = `routing-a-${token}`,
      runB = `routing-b-${token}`;
    const companyA = `${token.slice(0, 11).toUpperCase()}A`,
      companyB = `${token.slice(0, 11).toUpperCase()}B`;
    const emailA = `routing-a-${token}@example.test`,
      emailB = `routing-b-${token}@example.test`;
    const connectionId = randomUUID();
    const foreignConnectionId = randomUUID();
    try {
      const a = await setUpApprovedGmailDraft(sql, runA, companyA, emailA);
      const b = await setUpApprovedGmailDraft(sql, runB, companyB, emailB);
      const binding = await setUpBoundBaseline(sql, connectionId);
      const input: GmailRoutingInput = {
        binding,
        threadId: "observed-thread",
        inReplyTo: null,
        references: null,
        fromAddress: "unrelated@example.test",
      };
      const classify = (changes: Partial<GmailRoutingInput> = {}) =>
        classifyGmailRouting(app, { ...input, ...changes });
      const [first] = await sql<
        Array<{ rfc: string }>
      >`select rfc_message_id as rfc from growth.email_messages where id=${a.approved.messageId}`;
      const [second] = await sql<
        Array<{ rfc: string }>
      >`select rfc_message_id as rfc from growth.email_messages where id=${b.approved.messageId}`;
      assert.ok(first?.rfc && second?.rfc);
      await sql`update growth.email_messages set provider_draft_id=null where id in (${a.approved.messageId},${b.approved.messageId})`;
      await sql`update growth.sequence_enrollments set gmail_thread_id='legacy-thread' where id=${a.approved.sequenceEnrollmentId}`;
      const competing = await classify({ threadId: "legacy-thread" });
      assert.equal(competing.kind, "unknown");
      if (competing.kind !== "unknown")
        throw new Error("Expected unbound candidate.");
      assert.equal(
        competing.safeToPause,
        false,
        "another unresolved attempt prevents a protective pause",
      );
      await sql`update growth.email_messages set status='queued' where id=${b.approved.messageId}`;
      const sole = await classify({ threadId: "legacy-thread" });
      assert.equal(sole.kind, "unknown");
      if (sole.kind !== "unknown")
        throw new Error("Expected unbound candidate.");
      assert.equal(
        sole.safeToPause,
        true,
        "the sole unbound candidate remains protectively pausable",
      );
      await sql`update growth.email_messages set status='provider_draft' where id=${b.approved.messageId}`;
      await sql`update growth.sequence_enrollments set gmail_thread_id=null where id=${a.approved.sequenceEnrollmentId}`;
      assert.equal(
        (await classify()).kind,
        "uncertain",
        "even an ambiguous draft creation without an ID holds without a reference",
      );
      await sql`update growth.email_messages set status='queued',provider_draft_id=null,attempt_count=0 where id in (${a.approved.messageId},${b.approved.messageId})`;
      assert.equal(
        (await classify()).kind,
        "none",
        "untouched queued messages do not imply invocation",
      );
      assert.equal(
        (await classify({ fromAddress: emailA })).kind,
        "uncertain",
        "a known recipient is a hold signal only",
      );
      assert.equal(
        (await classify({ inReplyTo: first.rfc })).kind,
        "uncertain",
        "a known legacy RFC is not mailbox attribution",
      );
      assert.equal(
        (await classify({ references: `${first.rfc} ${second.rfc}` })).kind,
        "ambiguous",
      );
      assert.equal(
        (await classify({ references: `${first.rfc} malformed` })).kind,
        "uncertain",
      );
      assert.equal(
        (await classify({ references: `${first.rfc} ${"x".repeat(16385)}` }))
          .kind,
        "uncertain",
      );
      for (const status of ["sending", "retry", "failed", "cancelled"]) {
        await sql`update growth.email_messages set status=${status},attempt_count=1 where id=${a.approved.messageId}`;
        assert.equal(
          (await classify({ references: "<nonmatching@example.test>" })).kind,
          "uncertain",
          status,
        );
      }
      await sql`update growth.email_messages set status='queued',attempt_count=0 where id=${a.approved.messageId}`;
      await sql`insert into growth.integration_connections(id,provider,subject_email,status,google_subject,granted_scopes) values (${foreignConnectionId},'gmail',${`foreign-${token}@example.test`},'connected','foreign-subject',${binding.grantedScopes})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${foreignConnectionId},${foreignConnectionId},false,'unknown')`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${b.approved.messageId},${b.approved.sequenceEnrollmentId},${foreignConnectionId},current_date,'submitting',${foreignConnectionId},1,${second.rfc},1,${"b".repeat(64)},${randomUUID()},now()+interval '1 hour',now())`;
      assert.equal(
        (await classify({ inReplyTo: second.rfc })).kind,
        "ambiguous",
        "a different account cannot authorize a match",
      );
      assert.equal(
        (await classify()).kind,
        "none",
        "a foreign-account reservation alone is excluded",
      );
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,submitted_at) values (${randomUUID()},${b.approved.messageId},${b.approved.sequenceEnrollmentId},${foreignConnectionId},current_date,'uncertain',now())`;
      assert.equal(
        (await classify()).kind,
        "uncertain",
        "a separate unbound uncertain reservation is retained",
      );
      await sql`delete from growth.outreach_reservations where connection_id is null and email_message_id=${b.approved.messageId}`;
      for (const status of ["sent", "rejected", "cancelled"]) {
        await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status) values (${randomUUID()},${b.approved.messageId},${b.approved.sequenceEnrollmentId},${foreignConnectionId},current_date,${status})`;
        assert.equal(
          (await classify()).kind,
          "uncertain",
          `legacy ${status} without conclusive provenance`,
        );
        await sql`delete from growth.outreach_reservations where connection_id is null and email_message_id=${b.approved.messageId}`;
      }
      await sql`delete from growth.outreach_reservations where connection_id=${foreignConnectionId}`;
      await sql`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connectionId},'test-subject',1,${binding.grantedScopes})`;
      await sql`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health) values (${connectionId},${connectionId},false,'unknown')`;
      const reservationId = randomUUID();
      await sql`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${reservationId},${randomUUID()},${a.approved.messageId},${a.approved.sequenceEnrollmentId},${connectionId},current_date,'submitting',${connectionId},1,${first.rfc},1,${"a".repeat(64)},${randomUUID()},now()+interval '1 hour',now())`;
      assert.equal(
        (await classify()).kind,
        "uncertain",
        "submitting is durable pre-I/O exposure",
      );
      assert.equal(
        (await classify({ references: "<nonmatching@example.test>" })).kind,
        "uncertain",
      );
      assert.equal(
        (await classify({ inReplyTo: first.rfc })).kind,
        "uncertain",
        "a known current-account reference without a thread is still not positive attribution",
      );
      await sql`update growth.outreach_reservations set status='accepted',provider_message_id='accepted',provider_thread_id='observed-thread',completed_at=now() where id=${reservationId}`;
      assert.equal(
        (await classify()).kind,
        "uncertain",
        "reservation thread alone does not complete association",
      );
      await sql`update growth.sequence_enrollments set gmail_thread_id='observed-thread' where id=${a.approved.sequenceEnrollmentId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "reservation and enrollment alone do not prove message receipt",
      );
      assert.equal(
        (await classify({ inReplyTo: first.rfc, references: first.rfc })).kind,
        "unique",
      );
      await sql`update growth.email_messages set status='retry',attempt_count=2 where id=${a.approved.messageId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "a complete receipt cannot erase another uncertain invocation",
      );
      await sql`update growth.email_messages set status='queued',attempt_count=0,provider_draft_id='unresolved-draft' where id=${a.approved.messageId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "an unresolved manual draft survives another receipt",
      );
      await sql`update growth.email_messages set provider_draft_id=null where id=${a.approved.messageId}`;
      const followupRfc = `<followup-${token}@example.test>`;
      await sql`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,rfc_message_id,idempotency_key)
      select gen_random_uuid(),id,prospect_id,contact_id,'gmail','outbound',1,'queued',${followupRfc},${`routing-followup-${token}`} from growth.sequence_enrollments where id=${a.approved.sequenceEnrollmentId}`;
      assert.equal(
        (await classify({ references: `${first.rfc} ${followupRfc}` })).kind,
        "unique",
        "consistent references to one sequence are not a conflict",
      );
      assert.equal(
        (await classify({ references: `${first.rfc} ${second.rfc}` })).kind,
        "ambiguous",
      );
      assert.equal(
        (await classify({ references: `${first.rfc} invalid` })).kind,
        "uncertain",
      );
      const conflictingRfc = `<conflicting-${token}@example.test>`;
      await sql`insert into growth.outreach_reservations(idempotency_key,email_message_id,sequence_id,account_id,london_day,status,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,submitted_at) values (${randomUUID()},${a.approved.messageId},${a.approved.sequenceEnrollmentId},${connectionId},current_date,'submitting',${connectionId},1,${conflictingRfc},1,${"c".repeat(64)},${randomUUID()},now()+interval '1 hour',now())`;
      assert.equal(
        (await classify({ inReplyTo: conflictingRfc })).kind,
        "ambiguous",
        "reservation and email RFC disagreement is not resolved by choosing one",
      );
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "one accepted association does not hide another unresolved reservation",
      );
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId} and rfc_message_id=${conflictingRfc}`;
      await sql`update growth.email_messages set status='sent',provider_message_id='accepted',provider_thread_id='observed-thread',sent_at=now() where id=${a.approved.messageId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "none",
        "matching message, receipt, account and thread can close this specific exposure",
      );
      await sql`update growth.email_messages set status='sent',attempt_count=0,provider_message_id=${`legacy-sent-${token}`},sent_at=now() where id=${b.approved.messageId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "legacy sent status without a bound association remains possible exposure",
      );
      await sql`update growth.email_messages set status='queued',attempt_count=0 where id=${b.approved.messageId}`;
      assert.equal(
        (await classify({ threadId: "other-thread" })).kind,
        "uncertain",
        "a persisted provider message is not erased by a later local status",
      );
      await sql`update growth.integration_connections set granted_scopes=${["openid", "email"]} where id=${connectionId}`;
      await assert.rejects(classify(), /grant changed/i);
      await sql`update growth.integration_connections set granted_scopes=${binding.grantedScopes} where id=${connectionId}`;
      await sql`update growth.integration_connections set status='revoked',version=version+1 where id=${connectionId}`;
      await assert.rejects(classify(), /grant changed/i);
    } finally {
      await sql`delete from growth.outreach_reservations where connection_id is null and account_id=${foreignConnectionId}`;
      await sql`delete from growth.outreach_reservations where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_reservations where connection_id=${foreignConnectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${connectionId}`;
      await sql`delete from growth.outreach_provider_usage where connection_id=${foreignConnectionId}`;
      await sql`delete from growth.outreach_account_controls where connection_id=${connectionId}`;
      await cleanUp(sql, runA, emailA, companyA);
      await cleanUp(sql, runB, emailB, companyB);
      await sql`delete from growth.gmail_reply_coverage where connection_id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${connectionId}`;
      await sql`delete from growth.integration_connections where id=${foreignConnectionId}`;
      await app.end();
      await sql.end();
    }
  },
);
