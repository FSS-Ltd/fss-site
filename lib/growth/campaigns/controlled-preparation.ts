import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { reviewedRecipientSchema } from "../sequences/reviewed-recipient";
import type { CanonicalOutreachPreparation } from "./dispatch-authority";
import { validateControlledCopy } from "./controlled-copy";
import { loadPolicyAuthorizedSourceProof } from "./founder-verification-reader";
import { campaignPolicyDefinitionSchema } from "./schemas";
import {
  hasFollowUpReplyCoverage,
  loadFollowUpAnchor,
} from "./follow-up-anchor";

const metadataSchema = z.strictObject({
  version: z.literal(1),
  variantId: z.string().min(1).max(200),
  variantVersion: z.number().int().positive(),
  observationProofId: z.uuid(),
  permissionId: z.uuid(),
  copySha256: z.string().regex(/^[a-f0-9]{64}$/),
  coverageId: z.uuid().optional(),
});
const recipientSnapshotSchema = z.object({
  reviewedRecipient: reviewedRecipientSchema,
  effectiveRecipient: reviewedRecipientSchema,
});

// Caller holds the existing account, membership, prospect, contact and message locks.
export async function loadControlledPreparation(
  tx: GrowthTransaction,
  input: {
    membershipId: string;
    connectionId: string;
    preparation: CanonicalOutreachPreparation;
  },
) {
  const proof = await loadPolicyAuthorizedSourceProof(tx, {
    membershipId: input.membershipId,
    messageId: input.preparation.messageId,
    connectionId: input.connectionId,
  });
  if (!proof) return null;
  const [row] = await tx<
    {
      metadata: unknown;
      recipients: unknown;
      policy: unknown;
      campaignId: string;
      policyVersion: number;
      businessId: string;
      businessName: string;
      market: string;
      permissionId: string;
      contactId: string;
      contactVersion: number;
      prospectVersion: number;
      observation: string;
      providerDraftId: string | null;
      step: number;
    }[]
  >`
    select em.controlled_preparation as metadata,se.template_snapshot as recipients,c.policy,
      m.campaign_id as "campaignId",m.policy_version as "policyVersion",m.business_id as "businessId",
      b.legal_name as "businessName",b.country_code as market,m.current_permission_id as "permissionId",
      ct.id as "contactId",ct.version as "contactVersion",p.version as "prospectVersion",e.claim_summary as observation,em.provider_draft_id as "providerDraftId",em.step_number as step
    from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    join growth.businesses b on b.id=m.business_id join growth.prospects p on p.id=m.prospect_id
    join growth.sequence_enrollments se on se.id=m.sequence_id join growth.contacts ct on ct.id=se.contact_id
    join growth.email_messages em on em.sequence_enrollment_id=se.id and em.id=${input.preparation.messageId}
    join growth.source_evidence e on e.id=${proof.proof.observationProofId} and e.prospect_id=p.id and e.claim_type='business_observation'
    where m.id=${input.membershipId}`;
  if (!row || row.providerDraftId !== null || ![0, 1, 2].includes(row.step))
    return null;
  const metadata = metadataSchema.safeParse(row.metadata);
  const recipients = recipientSnapshotSchema.safeParse(row.recipients);
  const policy = campaignPolicyDefinitionSchema.safeParse(row.policy);
  if (!metadata.success || !recipients.success || !policy.success) return null;
  const effective = recipients.data.effectiveRecipient;
  const reviewed = recipients.data.reviewedRecipient;
  if (row.step !== 0 && !metadata.data.coverageId) return null;
  const recipient = input.preparation.recipient.trim().toLowerCase();
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        input.preparation.subject,
        input.preparation.html,
        input.preparation.text,
      ]),
    )
    .digest("hex");
  const anchor =
    row.step === 0
      ? null
      : await loadFollowUpAnchor(tx, {
          membershipId: input.membershipId,
          connectionId: input.connectionId,
          step: row.step === 1 ? 1 : 2,
        });
  if (
    row.step !== 0 &&
    (!anchor ||
      anchor.subject !== input.preparation.subject ||
      anchor.threadId !== input.preparation.gmailThreadId ||
      anchor.campaign.campaignId !== row.campaignId ||
      anchor.campaign.policyVersion !== row.policyVersion ||
      anchor.campaign.businessId !== row.businessId ||
      anchor.campaign.market !== row.market ||
      anchor.campaign.offer !== policy.data.offer ||
      anchor.campaign.variantId !== metadata.data.variantId ||
      anchor.campaign.variantVersion !== metadata.data.variantVersion ||
      anchor.campaign.permissionId !== metadata.data.permissionId ||
      anchor.campaign.sourceProof.observationProofId !==
        metadata.data.observationProofId ||
      JSON.stringify(anchor.campaign.commercialTerms) !==
        JSON.stringify(policy.data.commercialTerms) ||
      JSON.stringify(anchor.campaign.reviewedRecipient) !==
        JSON.stringify(reviewed) ||
      JSON.stringify(anchor.campaign.effectiveRecipient) !==
        JSON.stringify(effective))
  )
    return null;
  if (
    anchor &&
    !(await hasFollowUpReplyCoverage(tx, {
      connectionId: input.connectionId,
      googleSubject: anchor.googleSubject,
      submittedAt: anchor.submittedAt,
    }))
  )
    return null;
  if (
    reviewed.email !== recipient ||
    effective.email !== recipient ||
    reviewed.contactId !== row.contactId ||
    effective.contactId !== row.contactId ||
    effective.contactVersion !== row.contactVersion ||
    effective.prospectVersion !== row.prospectVersion ||
    metadata.data.permissionId !== row.permissionId ||
    metadata.data.observationProofId !== proof.proof.observationProofId ||
    metadata.data.copySha256 !== digest ||
    !policy.data.offer ||
    !policy.data.jurisdiction ||
    !policy.data.cadenceFamily ||
    !validateControlledCopy({
      campaignId: row.campaignId,
      policyVersion: row.policyVersion,
      businessId: row.businessId,
      market: row.market,
      jurisdiction: policy.data.jurisdiction,
      offer: policy.data.offer,
      commercialTerms: policy.data.commercialTerms,
      variants: policy.data.variants,
      variantId: metadata.data.variantId,
      variantVersion: metadata.data.variantVersion,
      businessName: row.businessName,
      observation: row.observation,
      step: row.step === 1 ? 1 : row.step === 2 ? 2 : 0,
      copy: input.preparation,
    })
  )
    return null;
  return {
    campaignId: row.campaignId,
    policyVersion: row.policyVersion,
    businessId: row.businessId,
    membershipId: input.membershipId,
    market: row.market,
    offer: policy.data.offer,
    ...(policy.data.commercialTerms
      ? { commercialTerms: policy.data.commercialTerms }
      : {}),
    cadenceFamily: policy.data.cadenceFamily,
    variantId: metadata.data.variantId,
    variantVersion: metadata.data.variantVersion,
    copySha256: digest,
    assignment: "sha256_campaign_policy_v1" as const,
    permissionId: row.permissionId,
    sourceProof: {
      ...proof.proof,
      freshUntil: proof.proof.freshUntil.toISOString(),
    },
    reviewedRecipient: reviewed,
    effectiveRecipient: effective,
  };
}
