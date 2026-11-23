import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { TZDateMini } from "@date-fns/tz";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { loadReportEvidence } from "../../../lib/growth/campaigns/report-evidence";
import { appendCampaignEventAndOutbox } from "../../../lib/growth/campaigns/events";

/** Synthetic future cutoff simulates the 14-day observation window; no provider I/O. */
export async function exerciseResendReportCoverage(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    campaignId: string;
    membershipId: string;
    reservationId: string;
    monitorId: string;
    sequenceId: string;
    prospectId: string;
    contactId: string;
    recipient: string;
    address: string;
    subject: string;
  },
): Promise<void> {
  const coverageId = randomUUID(),
    gapId = randomUUID(),
    inboundId = randomUUID(),
    inboundEventId = randomUUID(),
    reviewId = randomUUID(),
    crossedId = randomUUID(),
    crossedEvent = randomUUID(),
    crossedReview = randomUUID();
  const providerId = `synthetic-inbound-${randomUUID()}`;
  const [receipt] = await admin<
    { at: Date; submitted: Date; rfc: string }[]
  >`select confirmation_observed_at as at,submitted_at as submitted,confirmation_receipt->>'rfcMessageId' as rfc from growth.outreach_reservations where id=${input.reservationId}`;
  if (!receipt) throw new Error("missing receipt");
  const until = new TZDateMini(receipt.at.getTime(), "Europe/London");
  until.setDate(until.getDate() + 14);
  const end = new Date(until.getTime() + 1000),
    cutoff = new Date(end.getTime() + 1000),
    from = new Date(receipt.submitted.getTime() - 1000);
  const projection = () =>
    withGrowthTransaction(db, (tx) =>
      loadReportEvidence(tx, input.campaignId, cutoff, input.reservationId),
    );
  try {
    await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state) values (${coverageId},${input.monitorId},1,${input.subject},'1','2',${from},${end},${end},${end},'complete')`;
    assert.equal((await projection()).members[0]?.replyCoverage, "complete");
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,provider_message_id,provider_thread_id,received_at) values (${inboundId},${input.sequenceId},${input.prospectId},${input.contactId},'gmail','inbound',0,'received',${randomUUID()},${providerId},${`thread-${randomUUID()}`},clock_timestamp())`;
    assert.equal((await projection()).members[0]?.replyCoverage, "unknown");
    const attribution = {
      basis: "gmail_exact_reference_v1",
      outboundProvider: "resend",
      reservationId: input.reservationId,
      rfcMessageId: receipt.rfc,
      connectionId: input.monitorId,
      googleSubject: input.subject,
      grantEpoch: 1,
      recipient: input.recipient,
    };
    await admin`insert into growth.email_events(id,email_message_id,provider,provider_event_id,event_type,occurred_at,sanitised_payload,outreach_reply_reservation_id,outreach_reply_attribution) values (${inboundEventId},${inboundId},'gmail',${providerId},'reply',clock_timestamp(),${admin.json({ from: input.recipient })},${input.reservationId},${admin.json(attribution)})`;
    const email = "j.ntagengwa@faithfulsoftware.dev",
      founder = {
        email,
        actorId: createHash("sha256").update(email).digest("hex"),
      };
    await withGrowthTransaction(db, (tx) =>
      appendCampaignEventAndOutbox(tx, {
        campaignId: input.campaignId,
        version: 1,
        membershipId: input.membershipId,
        resultId: inboundId,
        requestId: reviewId,
        requestHash: "a".repeat(64),
        type: "record_reply",
        founder,
        correlationId: "synthetic-report",
        replyReview: { inboundMessageId: inboundId, kind: "positive" },
      }),
    );
    let result = await projection();
    assert.equal(result.members[0]?.replyCoverage, "complete");
    assert.equal(result.members[0]?.replies[0]?.kind, "positive");
    const crossedProvider = `crossed-${randomUUID()}`;
    await admin`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,provider_message_id,provider_thread_id,received_at) values (${crossedId},${input.sequenceId},${input.prospectId},${input.contactId},'gmail','inbound',0,'received',${randomUUID()},${crossedProvider},${`thread-${randomUUID()}`},clock_timestamp())`;
    await admin`insert into growth.email_events(id,email_message_id,provider,provider_event_id,event_type,occurred_at,sanitised_payload,outreach_reply_reservation_id,outreach_reply_attribution) values (${crossedEvent},${crossedId},'gmail',${crossedProvider},'reply',clock_timestamp(),${admin.json({ from: "wrong@example.test" })},${input.reservationId},${admin.json(attribution)})`;
    await withGrowthTransaction(db, (tx) =>
      appendCampaignEventAndOutbox(tx, {
        campaignId: input.campaignId,
        version: 1,
        membershipId: input.membershipId,
        resultId: crossedId,
        requestId: crossedReview,
        requestHash: "b".repeat(64),
        type: "record_reply",
        founder,
        correlationId: "synthetic-report",
        replyReview: { inboundMessageId: crossedId, kind: "positive" },
      }),
    );
    result = await projection();
    assert.equal(result.members[0]?.replyCoverage, "unknown");
    assert.equal(result.members[0]?.replies.length, 1);
    await admin`delete from growth.outreach_outbox where event_id=${crossedReview}`;
    await admin`delete from growth.outreach_events where id=${crossedReview}`;
    await admin`delete from growth.email_events where id=${crossedEvent}`;
    await admin`delete from growth.email_messages where id=${crossedId}`;
    await admin`update growth.integration_connections set version=version+1 where id=${input.monitorId}`;
    result = await projection();
    assert.equal(result.members[0]?.replyCoverage, "unknown");
    assert.equal(result.members[0]?.replies[0]?.kind, "positive");
    await admin`update growth.integration_connections set version=version-1 where id=${input.monitorId}`;
    await admin`insert into growth.gmail_reply_coverage(id,connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason) values (${gapId},${input.monitorId},1,${input.subject},'3','4',${new Date(receipt.at.getTime() + 1000)},${new Date(receipt.at.getTime() + 2000)},${end},${end},'gap','synthetic_gap')`;
    result = await projection();
    assert.equal(result.members[0]?.replyCoverage, "unknown");
    assert.equal(result.members[0]?.replies[0]?.kind, "positive");
  } finally {
    await admin`delete from growth.audit_log where correlation_id='synthetic-report'`;
    await admin`delete from growth.outreach_outbox where event_id in (${reviewId},${crossedReview})`;
    await admin`delete from growth.outreach_events where id in (${reviewId},${crossedReview})`;
    await admin`delete from growth.email_events where id in (${inboundEventId},${crossedEvent})`;
    await admin`delete from growth.email_messages where id in (${inboundId},${crossedId})`;
    await admin`delete from growth.gmail_reply_coverage where id in (${coverageId},${gapId})`;
  }
}
