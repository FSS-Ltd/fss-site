import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { prepareFollowUp } from "../../../lib/growth/campaigns/prepare-follow-up";
import { loadControlledPreparation } from "../../../lib/growth/campaigns/controlled-preparation";
import {
  reserveOutreachAttempt,
  beginOutreachSubmission,
} from "../../../lib/growth/campaigns/reservation-repository";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";

export async function exerciseFollowUpPreparation(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    campaignId: string;
    membershipId: string;
    sequenceId: string;
    connectionId: string;
    firstMessageId: string;
    recipient: string;
    copy: { subject: string; html: string; text: string };
  },
): Promise<void> {
  const {
    campaignId,
    membershipId,
    sequenceId,
    connectionId,
    firstMessageId,
    recipient,
    copy,
  } = input;
  const [anchor] = await admin<{ submittedAt: Date; threadId: string }[]>`
    select r.submitted_at as "submittedAt",r.provider_thread_id as "threadId" from growth.campaign_memberships m
    join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id where m.id=${membershipId}`;
  assert.ok(anchor?.submittedAt && anchor.threadId);
  await admin`update growth.email_messages set subject_snapshot=${copy.subject},html_snapshot=${copy.html},text_snapshot=${copy.text} where id=${firstMessageId}`;
  await admin`update growth.campaigns set status='approved' where id=${campaignId} and version=2`;
  await admin`update growth.campaign_memberships set status='active' where id=${membershipId}`;
  // The prior confirmation fixture deliberately stopped this synthetic sequence.
  await admin.begin(async (tx) => {
    await tx`alter table growth.sequence_enrollments disable trigger reject_stopped_sequence_reactivation`;
    await tx`update growth.sequence_enrollments set status='active' where id=${sequenceId}`;
    await tx`alter table growth.sequence_enrollments enable trigger reject_stopped_sequence_reactivation`;
  });
  await admin`update growth.email_messages set status='draft',scheduled_for=clock_timestamp()-interval '1 minute' where sequence_enrollment_id=${sequenceId} and step_number in (1,2)`;
  await admin`update growth.outreach_jobs j set status='leased',lease_owner='test-follow-up',lease_revision=lease_revision+1,lease_until=clock_timestamp()+interval '5 minutes',due_at=em.scheduled_for
    from growth.email_messages em where j.membership_id=${membershipId} and j.job_type='follow_up' and em.idempotency_key=j.idempotency_key`;
  const jobs = await admin<{ id: string; key: string; revision: string }[]>`
    select id,idempotency_key as key,lease_revision::text as revision from growth.outreach_jobs where membership_id=${membershipId} and job_type='follow_up' order by key`;
  const first = jobs.find((job) => job.key.endsWith(":1"));
  const second = jobs.find((job) => job.key.endsWith(":2"));
  assert.ok(first && second);
  const coverageId = randomUUID();
  let followUpReservationId: string | null = null;
  let nextCoverageId: string | null = null;
  const coverageEnd = new Date();
  const coverageStart = new Date(anchor.submittedAt.getTime() - 1000);
  await admin`update growth.integration_connections set provider_cursor='301' where id=${connectionId}`;
  await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state)
    values (${coverageId},${connectionId},1,'test-subject','300','301',${coverageStart},${coverageEnd},${coverageEnd},${coverageEnd},'complete')`;
  const call = {
    jobId: first.id,
    leaseOwner: "test-follow-up",
    leaseRevision: first.revision,
    connectionId,
    coverageId,
  };
  try {
    assert.deepEqual(
      await prepareFollowUp(db, { ...call, coverageId: randomUUID() }),
      { status: "held", reason: "reply_coverage_unknown" },
    );
    assert.deepEqual(
      await prepareFollowUp(db, { ...call, leaseRevision: "999" }),
      { status: "held", reason: "job_lease_invalid" },
    );
    const gapId = randomUUID();
    const gapEnd = new Date(coverageEnd.getTime() - 1);
    await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason)
      values (${gapId},${connectionId},1,'test-subject','300','301',${coverageStart},${gapEnd},${coverageEnd},${coverageEnd},'gap','synthetic_gap')`;
    try {
      assert.deepEqual(await prepareFollowUp(db, call), {
        status: "held",
        reason: "reply_coverage_unknown",
      });
    } finally {
      await admin`delete from growth.gmail_reply_coverage where id=${gapId}`;
    }
    assert.deepEqual(
      await prepareFollowUp(db, {
        ...call,
        jobId: second.id,
        leaseRevision: second.revision,
      }),
      { status: "held", reason: "reply_coverage_unknown" },
    );
    await admin`update growth.email_messages set text_snapshot='existing draft' where idempotency_key=${first.key}`;
    assert.deepEqual(await prepareFollowUp(db, call), {
      status: "held",
      reason: "follow_up_excluded",
    });
    await admin`update growth.email_messages set text_snapshot=null where idempotency_key=${first.key}`;
    await admin`update growth.sequence_enrollments set status='paused' where id=${sequenceId}`;
    assert.deepEqual(await prepareFollowUp(db, call), {
      status: "held",
      reason: "follow_up_excluded",
    });
    await admin`update growth.sequence_enrollments set status='active' where id=${sequenceId}`;
    await admin`insert into growth.suppressions(normalised_email,reason,source,created_by) values (${recipient},'opt_out','manual','test')`;
    assert.deepEqual(await prepareFollowUp(db, call), {
      status: "held",
      reason: "follow_up_excluded",
    });
    await admin`delete from growth.suppressions where normalised_email=${recipient}`;
    await admin`create function growth.test_follow_up_audit_failure() returns trigger language plpgsql as $$ begin if new.action='campaign.follow_up_prepared' then raise exception 'test follow up audit failure'; end if; return new; end $$`;
    await admin`create trigger test_follow_up_audit_failure before insert on growth.audit_log for each row execute function growth.test_follow_up_audit_failure()`;
    try {
      await assert.rejects(
        prepareFollowUp(db, call),
        /test follow up audit failure/,
      );
      const [unchanged] = await admin<
        { status: string; messageStatus: string }[]
      >`select j.status,em.status as "messageStatus" from growth.outreach_jobs j join growth.email_messages em on em.idempotency_key=j.idempotency_key where j.id=${first.id}`;
      assert.deepEqual(unchanged, { status: "leased", messageStatus: "draft" });
    } finally {
      await admin`drop trigger test_follow_up_audit_failure on growth.audit_log`;
      await admin`drop function growth.test_follow_up_audit_failure()`;
    }
    const results = await Promise.all([
      prepareFollowUp(db, call),
      prepareFollowUp(db, call),
    ]);
    assert.ok(results[0]?.status === "ready" && results[1]?.status === "ready");
    assert.equal(results[0].value.messageId, results[1].value.messageId);
    assert.deepEqual(
      results
        .map(
          (result) => result.status === "ready" && result.value.alreadyExisted,
        )
        .sort(),
      [false, true],
    );
    assert.deepEqual(
      await prepareFollowUp(db, { ...call, coverageId: randomUUID() }),
      { status: "held", reason: "job_replay_conflict" },
    );
    const [message] = await admin<
      { id: string; subject: string; html: string; text: string }[]
    >`select id,subject_snapshot as subject,html_snapshot as html,text_snapshot as text from growth.email_messages where id=${results[0].value.messageId}`;
    assert.ok(message);
    assert.equal(message.subject, copy.subject);
    assert.notEqual(message.text, copy.text);
    const terminal = await withGrowthTransaction(db, (tx) =>
      loadControlledPreparation(tx, {
        membershipId,
        connectionId,
        preparation: {
          messageId: message.id,
          sequenceId,
          recipient,
          subject: message.subject,
          html: message.html,
          text: message.text,
          gmailThreadId: anchor.threadId,
          references: ["<synthetic@faithfulsoftware.dev>"],
          fingerprint: "a".repeat(64),
        },
      }),
    );
    assert.ok(terminal);
    await admin`update growth.integration_connections set provider_cursor='302' where id=${connectionId}`;
    assert.equal(
      await withGrowthTransaction(db, (tx) =>
        loadControlledPreparation(tx, {
          membershipId,
          connectionId,
          preparation: {
            messageId: message.id,
            sequenceId,
            recipient,
            subject: message.subject,
            html: message.html,
            text: message.text,
            gmailThreadId: anchor.threadId,
            references: ["<synthetic@faithfulsoftware.dev>"],
            fingerprint: "a".repeat(64),
          },
        }),
      ),
      null,
    );
    await admin`update growth.integration_connections set provider_cursor='301' where id=${connectionId}`;
    assert.equal(
      await withGrowthTransaction(db, (tx) =>
        loadControlledPreparation(tx, {
          membershipId,
          connectionId,
          preparation: {
            messageId: message.id,
            sequenceId,
            recipient,
            subject: message.subject,
            html: message.html,
            text: message.text + " altered",
            gmailThreadId: anchor.threadId,
            references: ["<synthetic@faithfulsoftware.dev>"],
            fingerprint: "a".repeat(64),
          },
        }),
      ),
      null,
    );
    const leaseToken = randomUUID();
    await admin`update growth.email_messages set status='sending',lease_token=${leaseToken},lease_expires_at=clock_timestamp()+interval '5 minutes',outreach_claim_previous_status='queued',outreach_guarded_claim=true where id=${message.id}`;
    const reserved = await reserveOutreachAttempt(db, {
      messageId: message.id,
      leaseToken,
      attemptKey: randomUUID(),
    });
    assert.equal(reserved.status, "ready");
    followUpReservationId = reserved.value.reservationId;
    const issued = await beginOutreachSubmission(db, {
      reservationId: reserved.value.reservationId,
      leaseToken,
      fence: reserved.value.fence,
      fingerprint: reserved.value.preparation.fingerprint,
    });
    assert.equal(issued.status, "ready");
    await seedSyntheticDirectSubmission(
      db,
      issued.value.reservationId,
      "followup-message",
      anchor.threadId,
    );
    const confirm = createGmailConfirmation(db, async () => ({
      binding: {
        connectionId,
        googleSubject: "test-subject",
        grantEpoch: 1,
        grantedScopes: [
          "openid",
          "email",
          "https://www.googleapis.com/auth/gmail.modify",
        ],
      },
      client: {
        getProfile: async () => ({
          emailAddress: "j.ntagengwa@faithfulsoftware.dev",
          historyId: "301",
        }),
        findByRfcMessageId: async () => ({
          messageId: "followup-message",
          gmailThreadId: anchor.threadId,
          historyId: "301",
          labelIds: ["SENT"],
          receivedAt: new Date(Date.now() - 1000).toISOString(),
          from: "j.ntagengwa@faithfulsoftware.dev",
          to: recipient,
          cc: null,
          bcc: null,
          inReplyTo: null,
          references: null,
          subject: message.subject,
          rfcMessageId: issued.value.rfcMessageId,
          autoSubmitted: null,
          precedence: null,
          returnPath: null,
          autoResponseSuppress: null,
        }),
      },
    }));
    assert.equal((await confirm(issued.value.reservationId)).status, "ready");
    nextCoverageId = randomUUID();
    const nextEnd = new Date();
    await admin`update growth.integration_connections set provider_cursor='302' where id=${connectionId}`;
    await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state)
      values (${nextCoverageId},${connectionId},1,'test-subject','301','302',${coverageEnd},${nextEnd},${nextEnd},${nextEnd},'complete')`;
    const finalFollowUp = await prepareFollowUp(db, {
      ...call,
      jobId: second.id,
      leaseRevision: second.revision,
      coverageId: nextCoverageId,
    });
    assert.equal(finalFollowUp.status, "ready");
    const [last] = await admin<
      { subject: string; text: string }[]
    >`select subject_snapshot as subject,text_snapshot as text from growth.email_messages where id=${finalFollowUp.value.messageId}`;
    assert.equal(last?.subject, copy.subject);
    assert.notEqual(last?.text, message.text);
  } finally {
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where membership_id=${membershipId} and event_type='follow_up_prepared')`;
    await admin`delete from growth.outreach_events where membership_id=${membershipId} and event_type='follow_up_prepared'`;
    await admin`delete from growth.audit_log where correlation_id=${first.id} and action='campaign.follow_up_prepared'`;
    await admin`delete from growth.audit_log where correlation_id=${second.id} and action='campaign.follow_up_prepared'`;
    if (followUpReservationId) {
      await admin`delete from growth.outreach_outbox where event_id=${followUpReservationId}`;
      await admin`delete from growth.outreach_events where id=${followUpReservationId}`;
      await admin`delete from growth.audit_log where entity_id=${followUpReservationId}`;
      await admin`delete from growth.outreach_reservations where id=${followUpReservationId}`;
    }
    if (nextCoverageId)
      await admin`delete from growth.gmail_reply_coverage where id=${nextCoverageId}`;
    await admin`delete from growth.gmail_reply_coverage where id=${coverageId}`;
    await admin`update growth.integration_connections set provider_cursor=null where id=${connectionId}`;
  }
}
