import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { reserveOutreachAttempt } from "../../../lib/growth/campaigns/reservation-repository";
import { cancelOutreachReservation } from "../../../lib/growth/campaigns/reservation-settlement";
import { renderGmailMime } from "../../../lib/growth/email/gmail/mime";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";

export async function exerciseConfirmationCapacity(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    connectionId: string;
    sequenceId: string;
    existingMessageId: string;
    candidateMessageId: string;
    leaseToken: string;
  },
): Promise<void> {
  const addConfirmed = async (ageMs: number): Promise<string> => {
    const id = randomUUID(),
      observed = new Date(Date.now() - ageMs),
      before = new Date(observed.getTime() - 1000),
      provider = randomUUID();
    const rendered = renderGmailMime({
      id: input.existingMessageId,
      from: "sender@example.test",
      replyTo: "sender@example.test",
      to: "recipient@example.test",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });
    const rfc = rendered.rfcMessageId;
    const hash = createHash("sha256")
      .update(Buffer.from(rendered.raw, "base64url"))
      .digest("hex");
    const snapshot = {
      version: 1,
      kind: "direct_raw",
      raw: rendered.raw,
      rawSha256: hash,
      from: "sender@example.test",
      rfcMessageId: rfc,
      connectionId: input.connectionId,
      googleSubject: "test-subject",
      grantEpoch: 1,
      messageId: input.existingMessageId,
      sequenceId: input.sequenceId,
      membershipId: null,
      envelope: { to: ["recipient@example.test"], cc: [], bcc: [] },
    };
    await admin`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until) values (${id},${randomUUID()},${input.existingMessageId},${input.sequenceId},${input.connectionId},(now() at time zone 'Europe/London')::date-2,${input.connectionId},1,${rfc},1,${hash},${input.leaseToken},now()+interval '1 minute')`;
    await admin`update growth.outreach_reservations set status='submitting',submitted_at=${before},issued_snapshot=${admin.json(snapshot)},issued_snapshot_hash=${hash} where id=${id}`;
    await seedSyntheticDirectSubmission(admin, id, provider, "capacity-thread");
    const receipt = {
      basis: "gmail_fss_sent_observed",
      googleSubject: "test-subject",
      observationGrantEpoch: 1,
      providerMessageId: provider,
      providerThreadId: "capacity-thread",
      rfcMessageId: rfc,
      rawSha256: hash,
      observedFrom: before.toISOString(),
      observedUntil: observed.toISOString(),
      providerCreatedAt: before.toISOString(),
    };
    await admin`update growth.outreach_reservations set status='accepted',provider_message_id=${provider},provider_thread_id='capacity-thread',confirmation_receipt=${admin.json(receipt)},confirmation_observed_at=${observed} where id=${id}`;
    return id;
  };
  const old = await addConfirmed(25 * 3600000);
  const recent = await addConfirmed(23 * 3600000);
  const reserve = () =>
    reserveOutreachAttempt(db, {
      messageId: input.candidateMessageId,
      leaseToken: input.leaseToken,
      attemptKey: randomUUID(),
    });
  try {
    assert.deepEqual(await reserve(), {
      status: "held",
      reason: "provider_limit",
    });
    await admin`delete from growth.outreach_reservations where id=${recent}`;
    const available = await reserve();
    assert.equal(available.status, "ready");
    if (available.status !== "ready") throw new Error("capacity held");
    await cancelOutreachReservation(db, {
      reservationId: available.value.reservationId,
      leaseToken: input.leaseToken,
      fence: available.value.fence,
    });
    await admin`delete from growth.audit_log where entity_id=${available.value.reservationId}`;
    await admin`delete from growth.outreach_reservations where id=${available.value.reservationId}`;
    await admin`update growth.email_messages set rfc_message_id=null where id=${input.candidateMessageId}`;
    // Recreate a legacy unproved receipt state to exercise the defensive capacity reader.
    await admin.begin(async (tx) => {
      await tx`alter table growth.outreach_reservations drop constraint confirmed_requires_direct_submission`;
      await tx`alter table growth.outreach_reservations disable trigger protect_direct_submission_evidence`;
      await tx`update growth.outreach_reservations set direct_submission_evidence=null where id=${old}`;
      await tx`alter table growth.outreach_reservations enable trigger protect_direct_submission_evidence`;
      await tx`alter table growth.outreach_reservations add constraint confirmed_requires_direct_submission check (confirmation_receipt is null or direct_submission_evidence is not null) not valid`;
    });
    assert.deepEqual(await reserve(), {
      status: "held",
      reason: "provider_limit",
    });
  } finally {
    await admin`delete from growth.outreach_reservations where id in (${old},${recent})`;
    await admin`alter table growth.outreach_reservations validate constraint confirmed_requires_direct_submission`;
  }
}
