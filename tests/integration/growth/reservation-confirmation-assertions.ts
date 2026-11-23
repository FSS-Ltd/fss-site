import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { executeCampaignCommand } from "../../../lib/growth/campaigns/commands";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { postgresGmailSyncRepository } from "../../../lib/growth/sequences/gmail-sync-repository";
import { classifyGmailRouting } from "../../../lib/growth/sequences/gmail-routing-repository";
import { lockGmailRouting } from "../../../lib/growth/sequences/gmail-thread-association";
import { beginOutreachSubmission } from "../../../lib/growth/campaigns/reservation-repository";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import { exerciseReportCorrection } from "./reservation-report-assertions";
import { freezeCampaignConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation-campaign";
import { exerciseDirectProofRace } from "./direct-proof-race-assertions";
import { exerciseProoflessConfirmations } from "./proofless-confirmation-assertions";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";

export async function exerciseGmailConfirmation(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    campaign: { id: string };
    campaignBegin: {
      reservationId: string;
      leaseToken: string;
      fence: number;
      fingerprint: string;
    };
    contact: string;
    message: string;
    member: string;
    sequence: string;
    prospect: string;
    id: string;
    email: string;
    now: number;
    copyFacts: { email: string };
    copy: { subject: string };
    copySha256: string;
  },
): Promise<void> {
  const {
    campaign,
    campaignBegin,
    contact,
    message,
    member,
    sequence,
    prospect,
    id,
    email,
    now,
    copyFacts,
    copy,
    copySha256,
  } = input;
  await admin`update growth.contacts set version=version-1 where id=${contact}`;
  await admin`update growth.email_messages set provider_draft_id='manual-draft' where id=${message}`;
  assert.deepEqual(await beginOutreachSubmission(db, campaignBegin), {
    status: "held",
    reason: "controlled_variant_unproven",
  });
  await admin`update growth.email_messages set provider_draft_id=null where id=${message}`;
  const issued = await beginOutreachSubmission(db, campaignBegin);
  assert.equal(issued.status, "ready");
  if (issued.status !== "ready") throw new Error("issue failed");
  let unexpectedProviderCalls = 0;
  const proofless = createGmailConfirmation(db, async () => {
    unexpectedProviderCalls++;
    throw new Error("proofless attempt called provider");
  });
  assert.deepEqual(await proofless(campaignBegin.reservationId), {
    status: "held",
    reason: "direct_submission_unproven",
  });
  assert.equal(unexpectedProviderCalls, 0);
  await exerciseProoflessConfirmations(admin, db, {
    originalId: campaignBegin.reservationId,
    leaseToken: campaignBegin.leaseToken,
    memberId: member,
    campaignId: campaign.id,
  });
  await seedSyntheticDirectSubmission(
    db,
    campaignBegin.reservationId,
    "confirmed-message",
    "confirmed-thread",
  );
  await admin`update growth.email_messages set text_snapshot='later changed draft' where id=${message}`;
  const [connection] = await admin<{ version: number; scopes: string[] }[]>`
        select version,granted_scopes as scopes from growth.integration_connections where id=${id}`;
  assert.ok(connection);
  await admin`update growth.campaigns set status='paused' where id=${campaign.id} and version=2`;
  await admin`update growth.campaign_memberships set status='replied' where id=${member}`;
  await admin`update growth.sequence_enrollments set status='stopped_reply' where id=${sequence}`;
  let observingGrant = connection.version;
  let observedSubject = "test-subject";
  let observedTo = copyFacts.email;
  let observedFrom = email;
  let observedMessage = "confirmed-message";
  let observedThread = "confirmed-thread";
  let providerCreatedAt = new Date(now - 1000).toISOString();
  let observedCc: string | null = null;
  let observedBcc: string | null = null;
  let observedRfc = issued.value.rfcMessageId;
  const resolveClient = async () => ({
    binding: {
      connectionId: id,
      googleSubject: observedSubject,
      grantEpoch: observingGrant,
      grantedScopes: connection.scopes,
    },
    client: {
      getProfile: async () => ({ emailAddress: email, historyId: "200" }),
      findByRfcMessageId: async () => {
        await withGrowthTransaction(db, async (tx) => {
          await tx`set local lock_timeout='1s'`;
          await lockGmailRouting(tx);
        });
        return {
          messageId: observedMessage,
          gmailThreadId: observedThread,
          historyId: "200",
          labelIds: ["SENT"],
          receivedAt: providerCreatedAt,
          from: observedFrom,
          to: observedTo,
          cc: observedCc,
          bcc: observedBcc,
          inReplyTo: null,
          references: null,
          subject: copy.subject,
          rfcMessageId: observedRfc,
          autoSubmitted: null,
          precedence: null,
          returnPath: null,
          autoResponseSuppress: null,
        };
      },
    },
  });
  const confirm = createGmailConfirmation(db, resolveClient);
  await exerciseDirectProofRace(
    admin,
    db,
    resolveClient,
    campaignBegin.reservationId,
  );
  await admin`update growth.email_messages set provider_draft_id='manual-draft' where id=${message}`;
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "provider_draft_uncontrolled",
  });
  await admin`update growth.email_messages set provider_draft_id=null where id=${message}`;
  observedTo = "changed@example.test";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "recipient_changed",
  });
  observedTo = copyFacts.email;
  observedCc = "extra@example.test";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "recipient_changed",
  });
  observedCc = null;
  observedBcc = "hidden@example.test";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "recipient_changed",
  });
  observedBcc = null;
  observedThread = "different-thread";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "direct_submission_conflict",
  });
  observedThread = "confirmed-thread";
  observedRfc = "<other@example.test>";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "sent_observation_unknown",
  });
  observedRfc = issued.value.rfcMessageId;
  observedFrom = "different@example.test";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "sender_changed",
  });
  observedFrom = email;
  const conflictingFollowup = randomUUID();
  await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key) values (${conflictingFollowup},${sequence},${prospect},${contact},'gmail','outbound',1,'draft',${randomUUID()})`;
  try {
    assert.deepEqual(await confirm(campaignBegin.reservationId), {
      status: "held",
      reason: "followup_conflict",
    });
  } finally {
    await admin`delete from growth.email_messages where id=${conflictingFollowup}`;
  }
  const legacyReport = randomUUID();
  await admin`insert into growth.outreach_jobs(id,campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key) values (${legacyReport},${campaign.id},2,${member},'monthly_report',now(),${randomUUID()})`;
  try {
    assert.deepEqual(await confirm(campaignBegin.reservationId), {
      status: "held",
      reason: "report_job_conflict",
    });
  } finally {
    await admin`delete from growth.outreach_jobs where id=${legacyReport}`;
  }
  const competingSequence = randomUUID();
  await admin`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,gmail_thread_id) values (${competingSequence},${prospect},${contact},'completed','confirmed-thread')`;
  try {
    assert.deepEqual(await confirm(campaignBegin.reservationId), {
      status: "held",
      reason: "association_conflict",
    });
  } finally {
    await admin`delete from growth.sequence_enrollments where id=${competingSequence}`;
  }
  await admin`create function growth.test_reject_gmail_confirmation_audit() returns trigger language plpgsql as $$ begin if new.action='outreach_reservation.gmail_sent_observed' then raise exception 'test confirmation rollback'; end if; return new; end $$`;
  await admin`create trigger test_reject_gmail_confirmation_audit before insert on growth.audit_log for each row execute function growth.test_reject_gmail_confirmation_audit()`;
  try {
    await assert.rejects(
      confirm(campaignBegin.reservationId),
      /test confirmation rollback/,
    );
    const [rollback] = await admin<
      { receipt: unknown; jobs: number; followups: number }[]
    >`
          select confirmation_receipt as receipt,
            (select count(*)::int from growth.outreach_jobs where campaign_id=${campaign.id}) as jobs,
            (select count(*)::int from growth.email_messages where sequence_enrollment_id=${sequence} and step_number in (1,2)) as followups
          from growth.outreach_reservations where id=${campaignBegin.reservationId}`;
    assert.deepEqual(rollback, { receipt: null, jobs: 0, followups: 0 });
  } finally {
    await admin`drop trigger test_reject_gmail_confirmation_audit on growth.audit_log`;
    await admin`drop function growth.test_reject_gmail_confirmation_audit()`;
  }
  const [firstConfirmation, concurrentConfirmation] = await Promise.all([
    confirm(campaignBegin.reservationId),
    confirm(campaignBegin.reservationId),
  ]);
  assert.equal(firstConfirmation.status, "ready");
  assert.deepEqual(concurrentConfirmation, firstConfirmation);
  assert.deepEqual(
    await Promise.all([
      confirm(campaignBegin.reservationId),
      confirm(campaignBegin.reservationId),
    ]),
    [firstConfirmation, firstConfirmation],
  );
  await admin`update growth.email_messages set provider_thread_id='changed-thread' where id=${message}`;
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "association_conflict",
  });
  await admin`update growth.email_messages set provider_thread_id='confirmed-thread' where id=${message}`;
  observedMessage = "different-message";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "direct_submission_conflict",
  });
  observedMessage = "confirmed-message";
  providerCreatedAt = new Date(now - 2000).toISOString();
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "confirmation_conflict",
  });
  providerCreatedAt = new Date(now - 1000).toISOString();
  observedSubject = "different-subject";
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "account_changed",
  });
  observedSubject = "test-subject";
  observingGrant++;
  assert.deepEqual(await confirm(campaignBegin.reservationId), {
    status: "held",
    reason: "observation_grant_changed",
  });
  await admin`update growth.integration_connections set version=${observingGrant} where id=${id}`;
  assert.deepEqual(
    await confirm(campaignBegin.reservationId),
    firstConfirmation,
  );
  await admin`update growth.integration_connections set version=${connection.version} where id=${id}`;
  const changedSubjectReply = await classifyGmailRouting(db, {
    binding: {
      connectionId: id,
      googleSubject: "test-subject",
      grantEpoch: connection.version,
      grantedScopes: connection.scopes,
    },
    threadId: `changed-thread-${randomUUID()}`,
    inReplyTo: issued.value.rfcMessageId,
    references: null,
    fromAddress: copyFacts.email,
    fromHeader: `Owner <${copyFacts.email}>`,
  });
  assert.equal(changedSubjectReply.kind, "unique");
  if (changedSubjectReply.kind !== "unique")
    throw new Error("Gmail exact reference missing");
  assert.equal(changedSubjectReply.enrollment.id, sequence);
  assert.equal(changedSubjectReply.attribution?.outboundProvider, "gmail");
  assert.equal(
    changedSubjectReply.attribution?.reservationId,
    campaignBegin.reservationId,
  );
  const changedThread = `changed-thread-${randomUUID()}`;
  const inboundId = `changed-inbound-${randomUUID()}`;
  const observation = {
    messageId: inboundId,
    historyId: "200",
    threadId: changedThread,
    inReplyTo: issued.value.rfcMessageId,
    references: null,
    fromAddress: copyFacts.email,
    fromHeader: `Owner <${copyFacts.email}>`,
  };
  const reviewRequest = randomUUID();
  try {
    const recorded = await postgresGmailSyncRepository.recordInboundEvent(db, {
      binding: {
        connectionId: id,
        googleSubject: "test-subject",
        grantEpoch: connection.version,
        grantedScopes: connection.scopes,
      },
      sequenceEnrollmentId: sequence,
      prospectId: prospect,
      contactId: contact,
      gmailMessageId: inboundId,
      gmailThreadId: changedThread,
      observation,
      rfcMessageId: `<inbound-${randomUUID()}@example.test>`,
      from: observation.fromHeader,
      subject: "Changed subject",
      receivedAt: new Date(),
      eventType: "reply",
      correlationId: randomUUID(),
    });
    assert.equal(recorded.alreadyRecorded, false);
    const [stored] = await admin<
      { reservationId: string; provider: string }[]
    >`select e.outreach_reply_reservation_id as "reservationId",e.outreach_reply_attribution->>'outboundProvider' as provider from growth.email_events e join growth.email_messages em on em.id=e.email_message_id where em.provider_message_id=${inboundId}`;
    assert.deepEqual(stored, {
      reservationId: campaignBegin.reservationId,
      provider: "gmail",
    });
    const [reviewFacts] = await admin<
      { inboundId: string; policy: number; prospect: number; contact: number }[]
    >`select em.id as "inboundId",m.policy_version as policy,p.version as prospect,c.version as contact from growth.email_messages em join growth.campaign_memberships m on m.sequence_id=em.sequence_enrollment_id join growth.prospects p on p.id=m.prospect_id join growth.contacts c on c.id=p.primary_contact_id where em.provider_message_id=${inboundId} and m.id=${member}`;
    assert.ok(reviewFacts);
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const review = {
      type: "record_reply" as const,
      requestId: reviewRequest,
      membershipId: member,
      inboundMessageId: reviewFacts.inboundId,
      expectedPolicyVersion: reviewFacts.policy,
      expectedProspectVersion: reviewFacts.prospect,
      expectedContactVersion: reviewFacts.contact,
      kind: "bot" as const,
    };
    await admin`update growth.integration_connections set version=version+1 where id=${id}`;
    try {
      assert.equal(
        (await executeCampaignCommand(db, review, founder, reviewRequest)).id,
        reviewFacts.inboundId,
      );
    } finally {
      await admin`update growth.integration_connections set version=${connection.version} where id=${id}`;
    }
  } finally {
    await admin`delete from growth.outreach_outbox where event_id in (select id from growth.outreach_events where request_id=${reviewRequest})`;
    await admin`delete from growth.outreach_events where request_id=${reviewRequest}`;
    await admin`delete from growth.audit_log where correlation_id=${reviewRequest}`;
    await admin`delete from growth.email_events where email_message_id in (select id from growth.email_messages where provider_message_id=${inboundId})`;
    await admin`delete from growth.email_messages where provider_message_id=${inboundId}`;
  }

  const [confirmed] = await admin<
    {
      receipts: number;
      followups: number;
      cancelledJobs: number;
      jobs: number;
      events: number;
    }[]
  >`
        select (select count(*)::int from growth.outreach_reservations where id=${campaignBegin.reservationId} and confirmation_receipt is not null) as receipts,
          (select count(*)::int from growth.email_messages where sequence_enrollment_id=${sequence} and direction='outbound' and step_number in (1,2) and status='cancelled') as followups,
          (select count(*)::int from growth.outreach_jobs where membership_id=${member} and job_type='follow_up' and status='cancelled') as "cancelledJobs",
          (select count(*)::int from growth.outreach_jobs where campaign_id=${campaign.id} and job_type='monthly_report' and membership_id is null and status='pending') as jobs,
          (select count(*)::int from growth.outreach_events where membership_id=${member} and event_type='gmail_sent_observed') as events`;
  assert.deepEqual(confirmed, {
    receipts: 1,
    followups: 2,
    cancelledJobs: 2,
    jobs: 1,
    events: 1,
  });
  const [frozen] = await admin<
    { copyHash: string }[]
  >`select confirmed_snapshot->>'copySha256' as "copyHash" from growth.campaign_memberships where id=${member}`;
  assert.equal(frozen?.copyHash, copySha256);
  await assert.rejects(
    db`update growth.outreach_reservations set direct_submission_evidence='{}'::jsonb where id=${campaignBegin.reservationId}`,
    /direct submission evidence is immutable/,
  );
  await assert.rejects(
    db`update growth.outreach_reservations set direct_submission_evidence=null where id=${campaignBegin.reservationId}`,
    /direct submission evidence is immutable/,
  );
  await assert.rejects(
    db`update growth.outreach_reservations set confirmation_receipt='{}'::jsonb where id=${campaignBegin.reservationId}`,
    /confirmation receipt is immutable/,
  );
  await assert.rejects(
    db`update growth.outreach_reservations set issued_snapshot='{}'::jsonb where id=${campaignBegin.reservationId}`,
    /issued snapshot is immutable/,
  );
  await assert.rejects(
    db`update growth.campaign_memberships set confirmed_snapshot='{}'::jsonb where id=${member}`,
    /membership confirmation is immutable/,
  );
  const [privateFacts] = await admin<
    {
      actual: Date | null;
      sent: Date | null;
      anon: boolean;
      basis: string;
    }[]
  >`
        select r.actual_sent_at as actual,em.sent_at as sent,has_table_privilege('anon','growth.outreach_reservations','select') as anon,
          r.confirmation_receipt->>'basis' as basis from growth.outreach_reservations r join growth.email_messages em on em.id=r.email_message_id where r.id=${campaignBegin.reservationId}`;
  assert.deepEqual(privateFacts, {
    actual: null,
    sent: null,
    anon: false,
    basis: "gmail_fss_sent_observed",
  });
  if (firstConfirmation.status !== "ready")
    throw new Error("confirmation missing");
  const frozenCampaign = firstConfirmation.value.campaign;
  assert.ok(frozenCampaign);
  await assert.rejects(
    withGrowthTransaction(admin, async (tx) => {
      await tx`delete from growth.outreach_jobs where membership_id=${member} and job_type='follow_up'`;
      await tx`delete from growth.email_messages where sequence_enrollment_id=${sequence} and step_number in (1,2)`;
      await freezeCampaignConfirmation(tx, {
        campaign: frozenCampaign,
        memberStatus: "active",
        sequenceStatus: "active",
        policyReady: false,
        prospectId: prospect,
        contactId: contact,
        sequenceId: sequence,
        reservationId: campaignBegin.reservationId,
        observedUntil: firstConfirmation.value.anchor.observedAt,
      });
      const [state] = await tx<
        { held: number; drafts: number; report: number }[]
      >`select
      (select count(*)::int from growth.outreach_jobs where membership_id=${member} and job_type='follow_up' and status='held') as held,
      (select count(*)::int from growth.email_messages where sequence_enrollment_id=${sequence} and step_number in (1,2) and status='draft') as drafts,
      (select count(*)::int from growth.outreach_jobs where campaign_id=${campaign.id} and membership_id is null and job_type='monthly_report' and status='pending') as report`;
      assert.deepEqual(state, { held: 2, drafts: 2, report: 1 });
      throw new Error("paused fixture rollback");
    }),
    /paused fixture rollback/,
  );
  await exerciseReportCorrection(admin, db, {
    campaignId: campaign.id,
    reservationId: campaignBegin.reservationId,
    firstAnchor: firstConfirmation.value.anchor.observedAt,
  });
}
