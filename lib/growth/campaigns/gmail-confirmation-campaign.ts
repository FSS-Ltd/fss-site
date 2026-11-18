import { TZDateMini } from "@date-fns/tz";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { reviewedRecipientSchema } from "../sequences/reviewed-recipient";
import { campaignCadenceDays, campaignMonthAnniversary } from "./time";

export const campaignSchema = z.object({
  campaignId: z.uuid(),
  policyVersion: z.number().int().positive(),
  membershipId: z.uuid(),
  businessId: z.uuid(),
  cadenceFamily: z.enum(["review", "website", "facebook"]),
  market: z.string().min(1),
  offer: z.string().min(1),
  variantId: z.string().min(1),
  variantVersion: z.number().int().positive(),
  copySha256: z.string().regex(/^[a-f0-9]{64}$/),
  permissionId: z.uuid(),
  reviewedRecipient: reviewedRecipientSchema,
  effectiveRecipient: reviewedRecipientSchema,
  sourceProof: z.discriminatedUnion("origin", [
    z.object({
      origin: z.literal("founder"),
      requestId: z.uuid(),
      contactId: z.uuid(),
      contactProofId: z.uuid(),
      observationProofId: z.uuid(),
      proofContactVersion: z.number().int().positive(),
      proofProspectVersion: z.number().int().positive(),
      freshUntil: z.iso.datetime(),
    }),
    z.object({
      origin: z.literal("research"),
      bindingId: z.uuid(),
      contactId: z.uuid(),
      contactProofId: z.uuid(),
      observationProofId: z.uuid(),
      proofContactVersion: z.number().int().positive(),
      proofProspectVersion: z.number().int().positive(),
      freshUntil: z.iso.datetime(),
    }),
  ]),
});

export type CampaignReportLeaseFence = {
  jobId: string;
  leaseOwner: string;
  leaseRevision: string;
  anchorRevision: number;
  anchorReservationId: string;
};

function addLondonDays(anchor: Date, days: number): Date {
  const date = new TZDateMini(anchor.getTime(), "Europe/London");
  date.setDate(date.getDate() + days);
  return new Date(date.getTime());
}

export async function freezeCampaignConfirmation(
  tx: GrowthTransaction,
  input: {
    campaign: z.infer<typeof campaignSchema>;
    memberStatus: string;
    sequenceStatus: string;
    policyReady: boolean;
    prospectId: string;
    contactId: string;
    sequenceId: string;
    reservationId: string;
    observedUntil: Date;
  },
): Promise<void> {
  const { campaign } = input;
  await tx`update growth.campaign_memberships m set first_confirmation_reservation_id=${input.reservationId},confirmed_snapshot=(select issued_snapshot->'campaign' from growth.outreach_reservations where id=${input.reservationId}) where m.id=${campaign.membershipId}`;
  const terminal =
    !["active", "paused"].includes(input.memberStatus) ||
    !["active", "paused"].includes(input.sequenceStatus);
  const paused =
    !input.policyReady ||
    input.memberStatus === "paused" ||
    input.sequenceStatus === "paused";
  const offsets = campaignCadenceDays(campaign.cadenceFamily);
  for (let index = 0; index < 2; index++) {
    const step = index + 1,
      due = addLondonDays(input.observedUntil, offsets[index]);
    await tx`insert into growth.email_messages(sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,scheduled_for) values (${input.sequenceId},${input.prospectId},${input.contactId},'gmail','outbound',${step},${terminal ? "cancelled" : "draft"},${`campaign-followup:${campaign.membershipId}:${step}`},${due})`;
    await tx`insert into growth.outreach_jobs(campaign_id,policy_version,membership_id,job_type,due_at,idempotency_key,status) values (${campaign.campaignId},${campaign.policyVersion},${campaign.membershipId},'follow_up',${due},${`campaign-followup:${campaign.membershipId}:${step}`},${terminal ? "cancelled" : paused ? "held" : "pending"})`;
  }
  await reviseCampaignReportJob(tx, {
    campaignId: campaign.campaignId,
    policyVersion: campaign.policyVersion,
    reservationId: input.reservationId,
  });
}

export async function reviseCampaignReportJob(
  tx: GrowthTransaction,
  input: {
    campaignId: string;
    policyVersion: number;
    reservationId: string;
  },
): Promise<void> {
  const [anchor] = await tx<{ observedAt: Date | null }[]>`
    select confirmation_observed_at as "observedAt" from growth.outreach_reservations
    where id=${input.reservationId} and campaign_id=${input.campaignId} and policy_version=${input.policyVersion} and confirmation_receipt is not null`;
  if (!anchor?.observedAt) throw new Error("report_anchor_unknown");
  const [job] = await tx<
    { id: string; status: string; anchorAt: Date | null }[]
  >`select j.id,j.status,r.confirmation_observed_at as "anchorAt" from growth.outreach_jobs j left join growth.outreach_reservations r on r.id=j.anchor_reservation_id where j.campaign_id=${input.campaignId} and j.job_type='monthly_report' and j.membership_id is null for update of j`;
  if (!job)
    await tx`insert into growth.outreach_jobs(campaign_id,policy_version,job_type,due_at,idempotency_key,anchor_reservation_id,anchor_revision) values (${input.campaignId},${input.policyVersion},'monthly_report',${campaignMonthAnniversary(anchor.observedAt)},${`campaign-report:${input.campaignId}`},${input.reservationId},1)`;
  else if (!job.anchorAt) throw new Error("report_anchor_unknown");
  else if (anchor.observedAt < job.anchorAt)
    await tx`update growth.outreach_jobs set policy_version=${input.policyVersion},anchor_reservation_id=${input.reservationId},anchor_revision=anchor_revision+1,due_at=${campaignMonthAnniversary(anchor.observedAt)},status=case when status in ('leased','completed') then 'held' else status end,lease_revision=lease_revision+1,lease_owner=null,lease_until=null where id=${job.id}`;
}
