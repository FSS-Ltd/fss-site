import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { reviewedRecipientSchema } from "../sequences/reviewed-recipient";
import { loadReservationAccount } from "./account-repository";
import { buildControlledFirstMessage } from "./controlled-copy";
import { loadReviewMembershipPreparationAuthority } from "./founder-verification-reader";
import { held, type ReservationOutcome } from "./reservation-shared";
import { campaignPolicyDefinitionSchema } from "./schemas";

type FirstMessage = {
  sequenceId: string;
  messageId: string;
  alreadyExisted: boolean;
};
const inputSchema = z.strictObject({
  membershipId: z.uuid(),
  connectionId: z.uuid(),
  permissionEventId: z.uuid(),
});

// The source is a committed founder permission event. No caller supplies copy or proof.
export async function prepareFirstMessage(
  db: GrowthDb,
  raw: z.infer<typeof inputSchema>,
): Promise<ReservationOutcome<FirstMessage>> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return held("invalid_input");
  const input = parsed.data;
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [identity] = await tx<
      {
        campaignId: string;
        businessId: string;
        prospectId: string;
        policyVersion: number;
      }[]
    >`
      select campaign_id as "campaignId",business_id as "businessId",prospect_id as "prospectId",policy_version as "policyVersion" from growth.campaign_memberships where id=${input.membershipId}`;
    if (!identity) return held("membership_unavailable");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
    const account = await loadReservationAccount(tx, input.connectionId);
    if (account.status === "held") return account;
    await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
    const [member] = await tx<
      {
        status: string;
        sequenceId: string | null;
        prospectId: string;
        businessId: string;
        campaignId: string;
        policyVersion: number;
      }[]
    >`
      select status,sequence_id as "sequenceId",prospect_id as "prospectId",business_id as "businessId",campaign_id as "campaignId",policy_version as "policyVersion" from growth.campaign_memberships where id=${input.membershipId} for update`;
    if (
      !member ||
      member.prospectId !== identity.prospectId ||
      member.businessId !== identity.businessId ||
      member.campaignId !== identity.campaignId ||
      member.policyVersion !== identity.policyVersion
    )
      return held("identity_changed");
    const messageKey = `campaign-first:${input.membershipId}:${input.permissionEventId}`;
    if (member.sequenceId) {
      const [existing] = await tx<
        { id: string }[]
      >`select id from growth.email_messages where sequence_enrollment_id=${member.sequenceId} and idempotency_key=${messageKey} and step_number=0 and controlled_preparation is not null`;
      return existing
        ? {
            status: "ready",
            value: {
              sequenceId: member.sequenceId,
              messageId: existing.id,
              alreadyExisted: true,
            },
          }
        : held("existing_sequence");
    }
    if (member.status !== "review") return held("membership_unavailable");
    const [prospect] = await tx<
      { contactId: string }[]
    >`select primary_contact_id as "contactId" from growth.prospects where id=${identity.prospectId} for update`;
    if (!prospect?.contactId) return held("contact_unavailable");
    await tx`select id from growth.businesses where id=${identity.businessId} for share`;
    await tx`select id from growth.contacts where id=${prospect.contactId} for update`;
    const [fence] = await tx<
      { acquired: boolean }[]
    >`select growth.try_outreach_terminal_fence() as acquired`;
    if (!fence?.acquired) return held("terminal_fence_busy");
    const authority = await loadReviewMembershipPreparationAuthority(tx, {
      membershipId: input.membershipId,
      connectionId: input.connectionId,
      source: { kind: "permission_event", eventId: input.permissionEventId },
    });
    if (!authority) return held("preparation_not_authorized");
    const [facts] = await tx<
      {
        email: string;
        contactVersion: number;
        prospectVersion: number;
        businessName: string;
        market: string;
        policy: unknown;
        permissionId: string;
        observation: string;
        priorSequence: boolean;
      }[]
    >`
      select ct.normalised_email as email,ct.version as "contactVersion",p.version as "prospectVersion",b.legal_name as "businessName",b.country_code as market,c.policy,m.current_permission_id as "permissionId",e.claim_summary as observation,
        exists(select 1 from growth.sequence_enrollments prior where prior.prospect_id=p.id) as "priorSequence"
      from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
      join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
      join growth.businesses b on b.id=p.business_id join growth.contacts ct on ct.id=p.primary_contact_id and ct.id=${prospect.contactId}
      join growth.source_evidence e on e.id=${authority.proof.observationProofId} and e.prospect_id=p.id and e.claim_type='business_observation'
      where m.id=${input.membershipId}`;
    if (
      !facts ||
      facts.priorSequence ||
      facts.contactVersion !== authority.proof.proofContactVersion ||
      facts.prospectVersion !== authority.proof.proofProspectVersion
    )
      return held("identity_changed");
    const policy = campaignPolicyDefinitionSchema.safeParse(facts.policy);
    const recipient = reviewedRecipientSchema.safeParse({
      email: facts.email,
      contactId: prospect.contactId,
      contactVersion: facts.contactVersion,
      prospectVersion: facts.prospectVersion,
    });
    if (
      !policy.success ||
      !recipient.success ||
      !policy.data.offer ||
      !policy.data.jurisdiction
    )
      return held("preparation_invalid");
    const copy = buildControlledFirstMessage({
      campaignId: identity.campaignId,
      policyVersion: identity.policyVersion,
      businessId: identity.businessId,
      market: facts.market,
      jurisdiction: policy.data.jurisdiction,
      businessName: facts.businessName,
      observation: facts.observation,
      offer: policy.data.offer,
      commercialTerms: policy.data.commercialTerms,
      variants: policy.data.variants,
    });
    if (!copy) return held("copy_unavailable");
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (
      !clock ||
      clock.now < authority.bounds.validatedAt ||
      clock.now >= authority.bounds.expiresAt ||
      (authority.bounds.validThrough !== null &&
        clock.now > authority.bounds.validThrough)
    )
      return held("preparation_expired");
    const sequenceId = randomUUID();
    const messageId = randomUUID();
    const eventId = randomUUID();
    const digest = createHash("sha256")
      .update(JSON.stringify([copy.subject, copy.html, copy.text]))
      .digest("hex");
    await tx`insert into growth.sequence_enrollments(id,prospect_id,contact_id,status,template_snapshot) values (${sequenceId},${identity.prospectId},${prospect.contactId},'active',${tx.json({ approvedRecipient: facts.email, reviewedRecipient: recipient.data, effectiveRecipient: recipient.data })})`;
    await tx`insert into growth.email_messages(id,sequence_enrollment_id,prospect_id,contact_id,channel,direction,step_number,status,idempotency_key,scheduled_for,subject_snapshot,html_snapshot,text_snapshot,controlled_preparation) values (${messageId},${sequenceId},${identity.prospectId},${prospect.contactId},'gmail','outbound',0,'queued',${messageKey},clock_timestamp(),${copy.subject},${copy.html},${copy.text},${tx.json({ version: 1, variantId: copy.variantId, variantVersion: copy.variantVersion, observationProofId: authority.proof.observationProofId, permissionId: facts.permissionId, copySha256: digest })})`;
    await tx`update growth.sequence_enrollments set first_message_id=${messageId} where id=${sequenceId}`;
    await tx`update growth.campaign_memberships set sequence_id=${sequenceId},status='active',updated_at=clock_timestamp() where id=${input.membershipId}`;
    await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${eventId},${identity.campaignId},${identity.policyVersion},${input.membershipId},'first_message_prepared')`;
    await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${eventId})`;
    await appendAuditEvent(tx, {
      correlationId: input.permissionEventId,
      actorType: "system",
      actorId: "outreach-preparation",
      action: "campaign.first_message_prepared",
      entityType: "campaign_membership",
      entityId: input.membershipId,
    });
    return {
      status: "ready",
      value: { sequenceId, messageId, alreadyExisted: false },
    };
  });
}
