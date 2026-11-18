import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { withGrowthTransaction } from "../../../lib/growth/db/client";
import { reviseCampaignReportJob } from "../../../lib/growth/campaigns/gmail-confirmation-campaign";
import { seedSyntheticDirectSubmission } from "./synthetic-direct-submission";

export async function exerciseReportCorrection(
  admin: GrowthDb,
  db: GrowthDb,
  input: { campaignId: string; reservationId: string; firstAnchor: Date },
): Promise<void> {
  const createEarlierReceipt = async (offset: number): Promise<string> => {
    const newId = randomUUID();
    const at = new Date(input.firstAnchor.getTime() - offset);
    await admin`insert into growth.outreach_reservations(id,idempotency_key,campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence)
      select ${newId},${randomUUID()},campaign_id,policy_version,membership_id,email_message_id,sequence_id,account_id,london_day,connection_id,grant_epoch,rfc_message_id,recipient_count,authority_fingerprint,lease_token,lease_until,fence+${offset} from growth.outreach_reservations where id=${input.reservationId}`;
    await admin`update growth.outreach_reservations set status='submitting',submitted_at=${at},issued_snapshot=(select issued_snapshot from growth.outreach_reservations where id=${input.reservationId}),issued_snapshot_hash=(select issued_snapshot_hash from growth.outreach_reservations where id=${input.reservationId}) where id=${newId}`;
    await seedSyntheticDirectSubmission(
      admin,
      newId,
      `earlier-${offset}`,
      "confirmed-thread",
    );
    await admin`update growth.outreach_reservations set status='accepted',provider_message_id=${`earlier-${offset}`},provider_thread_id='confirmed-thread',confirmation_receipt=(select jsonb_set(jsonb_set(jsonb_set(jsonb_set(confirmation_receipt,'{providerMessageId}',to_jsonb(${`earlier-${offset}`}::text)),'{observedFrom}',to_jsonb(${new Date(at.getTime() - 1000).toISOString()}::text)),'{providerCreatedAt}',to_jsonb(${new Date(at.getTime() - 1000).toISOString()}::text)),'{observedUntil}',to_jsonb(${at.toISOString()}::text)) from growth.outreach_reservations where id=${input.reservationId}),confirmation_observed_at=${at} where id=${newId}`;
    return newId;
  };
  const [report] = await admin<
    { id: string }[]
  >`select id from growth.outreach_jobs where campaign_id=${input.campaignId} and job_type='monthly_report' and membership_id is null`;
  assert.ok(report);
  const pendingEarlier = await createEarlierReceipt(1000);
  await withGrowthTransaction(db, (tx) =>
    reviseCampaignReportJob(tx, {
      campaignId: input.campaignId,
      policyVersion: 2,
      reservationId: pendingEarlier,
    }),
  );
  const [pending] = await admin<
    { status: string; revision: number; anchor: string }[]
  >`
    select status,anchor_revision as revision,anchor_reservation_id as anchor from growth.outreach_jobs where id=${report.id}`;
  assert.deepEqual(pending, {
    status: "pending",
    revision: 2,
    anchor: pendingEarlier,
  });
  await admin`update growth.outreach_jobs set due_at='2000-01-01T00:00:00Z' where id=${report.id}`;
  const [lease] = await db<
    { revision: string }[]
  >`select lease_revision as revision from growth.claim_outreach_jobs('report-test',1,interval '1 hour') where id=${report.id}`;
  assert.ok(lease);
  const earlier = await createEarlierReceipt(2000);
  await withGrowthTransaction(db, (tx) =>
    reviseCampaignReportJob(tx, {
      campaignId: input.campaignId,
      policyVersion: 2,
      reservationId: earlier,
    }),
  );
  const [revised] = await admin<
    {
      id: string;
      status: string;
      revision: string;
      anchor: string;
      anchorRevision: number;
      owner: string | null;
    }[]
  >`select id,status,lease_revision as revision,anchor_reservation_id as anchor,anchor_revision as "anchorRevision",lease_owner as owner from growth.outreach_jobs where id=${report.id}`;
  assert.deepEqual(revised, {
    id: report.id,
    status: "held",
    revision: String(BigInt(lease.revision) + BigInt(1)),
    anchor: earlier,
    anchorRevision: 3,
    owner: null,
  });
  await admin`update growth.outreach_jobs set status='completed' where id=${report.id}`;
  const stillEarlier = await createEarlierReceipt(3000);
  await withGrowthTransaction(db, (tx) =>
    reviseCampaignReportJob(tx, {
      campaignId: input.campaignId,
      policyVersion: 2,
      reservationId: stillEarlier,
    }),
  );
  const [completedFence] = await admin<
    { status: string; anchor: string; revision: number }[]
  >`select status,anchor_reservation_id as anchor,anchor_revision as revision from growth.outreach_jobs where id=${report.id}`;
  assert.deepEqual(completedFence, {
    status: "held",
    anchor: stillEarlier,
    revision: 4,
  });
}
