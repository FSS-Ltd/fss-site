import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";
import { settleOutreachAttempt } from "../../../lib/growth/campaigns/reservation-settlement";

export async function exerciseProoflessConfirmations(
  admin: GrowthDb,
  db: GrowthDb,
  input: {
    originalId: string;
    leaseToken: string;
    memberId: string;
    campaignId: string;
  },
): Promise<void> {
  let providerCalls = 0;
  const confirm = createGmailConfirmation(db, async () => {
    providerCalls++;
    throw new Error("proofless attempt called provider");
  });
  const copies: string[] = [];
  try {
    const [identity] = await admin<
      {
        account: string;
        connection: string;
        grant: number;
        rfc: string;
        hash: string;
        subject: string;
      }[]
    >`
      select account_id as account,connection_id as connection,grant_epoch as grant,rfc_message_id as rfc,issued_snapshot_hash as hash,issued_snapshot->>'googleSubject' as subject
      from growth.outreach_reservations where id=${input.originalId}`;
    assert.ok(identity);
    const baseProof = {
      version: 1,
      kind: "gmail_api_send_message_v1",
      reservationId: input.originalId,
      accountId: identity.account,
      connectionId: identity.connection,
      googleSubject: identity.subject,
      grantEpoch: identity.grant,
      rfcMessageId: identity.rfc,
      rawSha256: identity.hash,
      providerMessageId: "proof-test-message",
      providerThreadId: "proof-test-thread",
    };
    const crossedProofs = [
      { ...baseProof, rawSha256: "b".repeat(64) },
      { ...baseProof, accountId: "other-account" },
      { ...baseProof, connectionId: randomUUID() },
      { ...baseProof, googleSubject: "other-subject" },
      { ...baseProof, grantEpoch: identity.grant + 1 },
      { ...baseProof, rfcMessageId: "<other@example.test>" },
      { ...baseProof, kind: "provider_draft" },
      { ...baseProof, providerMessageId: "other-message" },
      { ...baseProof, providerThreadId: "other-thread" },
      { ...baseProof, unexpected: true },
    ];
    await assert.rejects(
      db`insert into growth.outreach_reservations(id,idempotency_key,email_message_id,sequence_id,account_id,london_day,direct_submission_evidence)
      select ${randomUUID()},${randomUUID()},email_message_id,sequence_id,account_id,london_day,${db.json(baseProof)} from growth.outreach_reservations where id=${input.originalId}`,
      /direct submission evidence requires an existing reservation/,
    );
    for (const proof of crossedProofs) {
      await assert.rejects(
        db`update growth.outreach_reservations set status='accepted',provider_message_id='proof-test-message',provider_thread_id='proof-test-thread',direct_submission_evidence=${db.json(proof)} where id=${input.originalId}`,
      );
    }
    for (const outcome of ["uncertain", "accepted"] as const) {
      const id = randomUUID();
      copies.push(id);
      const [copy] = await admin<
        { fence: number }[]
      >`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
        select ${id},${randomUUID()},campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence+1 from growth.outreach_reservations where id=${input.originalId} returning fence`;
      assert.ok(copy);
      await admin`update growth.outreach_reservations set status='submitting',submitted_at=clock_timestamp(),issued_snapshot=(select issued_snapshot from growth.outreach_reservations where id=${input.originalId}),issued_snapshot_hash=(select issued_snapshot_hash from growth.outreach_reservations where id=${input.originalId}) where id=${id}`;
      const settlement =
        outcome === "accepted"
          ? {
              kind: "accepted" as const,
              providerMessageId: "proofless-provider",
              providerThreadId: "proofless-thread",
            }
          : { kind: "uncertain" as const };
      assert.equal(
        (
          await settleOutreachAttempt(db, {
            reservationId: id,
            leaseToken: input.leaseToken,
            fence: copy.fence,
            outcome: settlement,
          })
        ).status,
        "ready",
      );
      assert.deepEqual(await confirm(id), {
        status: "held",
        reason: "direct_submission_unproven",
      });
      const [state] = await admin<
        {
          evidence: unknown;
          receipt: unknown;
          provider: string | null;
          frozen: string | null;
          jobs: number;
          events: number;
          audits: number;
        }[]
      >`
        select r.direct_submission_evidence as evidence,r.confirmation_receipt as receipt,em.provider_message_id as provider,m.first_confirmation_reservation_id as frozen,
          (select count(*)::int from growth.outreach_jobs where campaign_id=${input.campaignId}) as jobs,
          (select count(*)::int from growth.outreach_events where membership_id=${input.memberId} and event_type='gmail_sent_observed') as events,
          (select count(*)::int from growth.audit_log where entity_id=${id} and action='outreach_reservation.gmail_sent_observed') as audits
        from growth.outreach_reservations r join growth.campaign_memberships m on m.id=r.membership_id join growth.email_messages em on em.id=r.email_message_id where r.id=${id}`;
      assert.deepEqual(state, {
        evidence: null,
        receipt: null,
        provider: null,
        frozen: null,
        jobs: 0,
        events: 0,
        audits: 0,
      });
      if (outcome === "accepted") {
        const lateProof = {
          ...baseProof,
          reservationId: id,
          providerMessageId: "proofless-provider",
          providerThreadId: "proofless-thread",
        };
        await assert.rejects(
          db`update growth.outreach_reservations set direct_submission_evidence=${db.json(lateProof)} where id=${id}`,
          /requires submitting to accepted transition/,
        );
      }
    }
    assert.equal(providerCalls, 0);
  } finally {
    for (const id of copies) {
      await admin`delete from growth.audit_log where entity_id=${id}`;
      await admin`delete from growth.outreach_reservations where id=${id}`;
    }
  }
}
