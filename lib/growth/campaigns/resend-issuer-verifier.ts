import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import type { ResendDeliveryCandidate } from "../integrations/resend/outreach-delivery-evidence";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { campaignSchema } from "./gmail-confirmation-campaign";
import {
  resendBindingSchema,
  type ResendBinding,
} from "./resend-account-readiness";
import { matchesResendSubmissionEvidence } from "./resend-reservation-evidence";
import { held } from "./reservation-shared";

const issuedSchema = z.object({
  version: z.literal(1),
  kind: z.literal("resend_json"),
  rawBody: z.string().min(1).max(1048576),
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  accountId: z.uuid(),
  connectionId: z.uuid(),
  sendGeneration: z.uuid(),
  idempotencyKey: z.string().min(1),
  messageId: z.uuid(),
  sequenceId: z.uuid(),
  membershipId: z.uuid(),
  from: z.email(),
  replyTo: z.email(),
  recipient: z.email(),
  campaign: campaignSchema,
});
/** Caller must independently authenticate the raw webhook before invoking this transaction helper. */
export async function verifyResendIssuer(
  tx: GrowthTransaction,
  config: { binding: ResendBinding },
  candidate: ResendDeliveryCandidate,
  options: { allowMissingCopyFamily?: boolean } = {},
) {
  await lockGmailRouting(tx);
  await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
  const identities = await tx<
    {
      id: string;
      campaignId: string;
      policyVersion: number;
      membershipId: string;
      businessId: string;
    }[]
  >`
  select r.id,r.campaign_id as "campaignId",r.policy_version as "policyVersion",r.membership_id as "membershipId",m.business_id as "businessId"
  from growth.outreach_reservations r join growth.campaign_memberships m on m.id=r.membership_id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version
  where r.connection_id=${candidate.connectionId} and r.outreach_provider='resend' and r.provider_message_id=${candidate.providerMessageId} limit 2`;
  if (identities.length !== 1)
    return held(identities.length ? "issuer_ambiguous" : "issuer_unknown");
  const identity = identities[0];
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
  const [control] = await tx<
    { binding: unknown; review: unknown; sender: string }[]
  >`
  select c.resend_binding as binding,ar.evidence as review,ic.subject_email as sender
  from growth.outreach_account_controls c join growth.integration_connections ic on ic.id=c.connection_id and ic.provider='resend'
  join growth.outreach_account_reviews ar on ar.id=c.resend_binding_review_id and ar.connection_id=c.connection_id and ar.kind='resend_configure' and ar.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")}
  where c.connection_id=${candidate.connectionId} and c.provider='resend' for share of c,ic`;
  const binding = resendBindingSchema.safeParse(control?.binding);
  const review = z
    .object({ binding: resendBindingSchema })
    .safeParse(control?.review);
  if (
    !control ||
    !binding.success ||
    !review.success ||
    JSON.stringify(binding.data) !== JSON.stringify(review.data.binding) ||
    JSON.stringify(binding.data) !== JSON.stringify(config.binding) ||
    control.sender !== candidate.sender ||
    binding.data.webhookGeneration !== candidate.webhookGeneration
  )
    return held("webhook_binding_unknown");
  await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
  const [member] = await tx<
    {
      status: string;
      first: string | null;
      sequenceId: string;
      prospectId: string;
    }[]
  >`
  select status,first_confirmation_reservation_id as first,sequence_id as "sequenceId",prospect_id as "prospectId"
  from growth.campaign_memberships where id=${identity.membershipId} and campaign_id=${identity.campaignId} and policy_version=${identity.policyVersion} for update`;
  if (!member?.sequenceId) return held("membership_unknown");
  const [row] = await tx<
    {
      status: string;
      snapshot: unknown;
      hash: string;
      evidence: unknown;
      accountId: string;
      connectionId: string;
      generation: string;
      key: string;
      messageId: string;
      sequenceId: string;
      providerId: string;
      submittedAt: Date;
      receipt: unknown;
      observedAt: Date | null;
    }[]
  >`
  select status,issued_snapshot as snapshot,issued_snapshot_hash as hash,direct_submission_evidence as evidence,account_id as "accountId",connection_id as "connectionId",resend_send_generation as generation,idempotency_key as key,email_message_id as "messageId",sequence_id as "sequenceId",provider_message_id as "providerId",submitted_at as "submittedAt",confirmation_receipt as receipt,confirmation_observed_at as "observedAt" from growth.outreach_reservations where id=${identity.id} for update`;
  const issued = issuedSchema.safeParse(row?.snapshot);
  if (
    !row ||
    row.status !== "accepted" ||
    !issued.success ||
    !row.submittedAt ||
    issued.data.accountId !== row.accountId ||
    issued.data.connectionId !== row.connectionId ||
    issued.data.sendGeneration !== row.generation ||
    issued.data.idempotencyKey !== row.key ||
    issued.data.messageId !== row.messageId ||
    issued.data.sequenceId !== row.sequenceId ||
    issued.data.membershipId !== identity.membershipId ||
    issued.data.campaign.campaignId !== identity.campaignId ||
    issued.data.campaign.policyVersion !== identity.policyVersion ||
    issued.data.campaign.membershipId !== identity.membershipId ||
    issued.data.from !== candidate.sender ||
    issued.data.replyTo !== binding.data.replyTo ||
    issued.data.recipient !== candidate.recipient ||
    row.generation !== binding.data.sendGeneration ||
    issued.data.bodySha256 !== row.hash ||
    createHash("sha256").update(issued.data.rawBody, "utf8").digest("hex") !==
      row.hash ||
    !matchesResendSubmissionEvidence(row.evidence, {
      version: 1,
      kind: "resend_api_send_email_v1",
      reservationId: identity.id,
      accountId: row.accountId,
      connectionId: row.connectionId,
      sendGeneration: row.generation,
      idempotencyKey: row.key,
      bodySha256: row.hash,
      providerMessageId: row.providerId,
    })
  )
    return held("issuer_unproven");
  const campaign = issued.data.campaign;
  const [message] = await tx<
    {
      step: number;
      status: string;
      sequenceStatus: string;
      prospectId: string;
      contactId: string;
      providerId: string | null;
      rfc: string | null;
      hasReply: boolean;
    }[]
  >`
  select em.step_number as step,em.status,se.status as "sequenceStatus",em.prospect_id as "prospectId",em.contact_id as "contactId",em.provider_message_id as "providerId",em.rfc_message_id as rfc,
    exists(select 1 from growth.email_messages incoming where incoming.sequence_enrollment_id=se.id and incoming.direction='inbound' and incoming.status='received') as "hasReply"
  from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id and se.prospect_id=em.prospect_id and se.contact_id=em.contact_id
  where em.id=${row.messageId} and se.id=${row.sequenceId} and em.channel='resend' and em.direction='outbound' for update of em,se`;
  if (
    !message ||
    member.sequenceId !== row.sequenceId ||
    member.prospectId !== message.prospectId ||
    campaign.businessId !== identity.businessId ||
    campaign.effectiveRecipient.contactId !== message.contactId ||
    campaign.reviewedRecipient.contactId !== message.contactId ||
    campaign.effectiveRecipient.email !== candidate.recipient ||
    (!options.allowMissingCopyFamily &&
      (!campaign.copyFamilyVersion || !campaign.copyFamilySha256)) ||
    (message.providerId !== null &&
      message.providerId !== candidate.providerMessageId) ||
    (message.rfc !== null && message.rfc !== candidate.rfcMessageId)
  )
    return held("membership_conflict");
  const [messageConflict] = await tx<
    { found: boolean }[]
  >`select exists(select 1 from growth.email_messages where id<>${row.messageId} and (rfc_message_id=${candidate.rfcMessageId} or (channel='resend' and provider_message_id=${candidate.providerMessageId}))) as found`;
  if (!messageConflict || messageConflict.found)
    return held("message_conflict");
  return {
    status: "ready" as const,
    value: { identity, row, member, message, campaign },
  };
}
