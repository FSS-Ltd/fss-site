import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { loadReservationAccount } from "./account-repository";
import { buildControlledFollowUp } from "./controlled-copy";
import {
  hasFollowUpReplyCoverage,
  loadFollowUpAnchor,
} from "./follow-up-anchor";
import { loadPolicyAuthorizedSourceProof } from "./founder-verification-reader";
import { held, type ReservationOutcome } from "./reservation-shared";
import { campaignPolicyDefinitionSchema } from "./schemas";

const inputSchema = z.strictObject({
  jobId: z.uuid(),
  leaseOwner: z.string().trim().min(1).max(200),
  leaseRevision: z.string().regex(/^[1-9][0-9]*$/),
  connectionId: z.uuid(),
  coverageId: z.uuid(),
});
type FollowUpResult = {
  messageId: string;
  step: 1 | 2;
  alreadyExisted: boolean;
};

// Called with an already committed due-job lease and actual Gmail sync result ID.
export async function prepareFollowUp(
  db: GrowthDb,
  raw: z.infer<typeof inputSchema>,
): Promise<ReservationOutcome<FollowUpResult>> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return held("invalid_input");
  const input = parsed.data;
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [identity] = await tx<
      {
        campaignId: string;
        policyVersion: number;
        membershipId: string;
        businessId: string;
        prospectId: string;
        sequenceId: string;
        contactId: string;
      }[]
    >`
      select m.campaign_id as "campaignId",m.policy_version as "policyVersion",m.id as "membershipId",m.business_id as "businessId",m.prospect_id as "prospectId",se.id as "sequenceId",se.contact_id as "contactId"
      from growth.outreach_jobs j join growth.campaign_memberships m on m.id=j.membership_id and m.campaign_id=j.campaign_id and m.policy_version=j.policy_version
      join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id where j.id=${input.jobId} and j.job_type='follow_up'`;
    if (!identity) return held("job_unavailable");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
    const account = await loadReservationAccount(tx, input.connectionId);
    if (account.status === "held") return account;
    await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
    await tx`select id from growth.campaign_memberships where id=${identity.membershipId} for update`;
    await tx`select id from growth.prospects where id=${identity.prospectId} for share`;
    await tx`select id from growth.businesses where id=${identity.businessId} for share`;
    await tx`select id from growth.contacts where id=${identity.contactId} for share`;
    await tx`select id from growth.sequence_enrollments where id=${identity.sequenceId} for update`;
    const [job] = await tx<
      {
        status: string;
        leaseOwner: string | null;
        leaseRevision: string;
        leaseUntil: Date | null;
        dueAt: Date;
        key: string;
      }[]
    >`
      select status,lease_owner as "leaseOwner",lease_revision::text as "leaseRevision",lease_until as "leaseUntil",due_at as "dueAt",idempotency_key as key
      from growth.outreach_jobs where id=${input.jobId} and membership_id=${identity.membershipId} and campaign_id=${identity.campaignId} and policy_version=${identity.policyVersion} and job_type='follow_up' for update`;
    const step =
      job?.key === `campaign-followup:${identity.membershipId}:1`
        ? 1
        : job?.key === `campaign-followup:${identity.membershipId}:2`
          ? 2
          : null;
    if (
      !job ||
      !step ||
      job.leaseOwner !== input.leaseOwner ||
      job.leaseRevision !== input.leaseRevision
    )
      return held("job_lease_invalid");
    const [fence] = await tx<
      { acquired: boolean }[]
    >`select growth.try_outreach_terminal_fence() as acquired`;
    if (!fence?.acquired) return held("terminal_fence_busy");
    const [message] = await tx<
      {
        id: string;
        status: string;
        metadata: unknown;
        subject: string | null;
        html: string | null;
        text: string | null;
        providerDraftId: string | null;
        scheduledFor: Date | null;
        policy: unknown;
        businessName: string;
        market: string;
        currentPermission: string | null;
        contactEmail: string;
        contactVersion: number;
        prospectVersion: number;
        observation: string;
        memberStatus: string;
        sequenceStatus: string;
        excluded: boolean;
        hasReply: boolean;
      }[]
    >`
      select em.id,em.status,em.controlled_preparation as metadata,em.subject_snapshot as subject,em.html_snapshot as html,em.text_snapshot as text,em.provider_draft_id as "providerDraftId",em.scheduled_for as "scheduledFor",c.policy,b.legal_name as "businessName",b.country_code as market,m.current_permission_id as "currentPermission",ct.normalised_email as "contactEmail",ct.version as "contactVersion",p.version as "prospectVersion",e.claim_summary as observation,m.status as "memberStatus",se.status as "sequenceStatus",
        (growth.is_outreach_client(p.id) or exists(select 1 from growth.suppressions s where s.business_id=b.id or s.normalised_email=ct.normalised_email)) as excluded,
        exists(select 1 from growth.email_messages inbound where inbound.sequence_enrollment_id=se.id and inbound.direction='inbound') as "hasReply"
      from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
      join growth.sequence_enrollments se on se.id=m.sequence_id and se.contact_id=${identity.contactId}
      join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id and p.primary_contact_id=se.contact_id
      join growth.businesses b on b.id=p.business_id join growth.contacts ct on ct.id=se.contact_id
      join growth.email_messages em on em.sequence_enrollment_id=se.id and em.step_number=${step} and em.idempotency_key=${job.key} and em.direction='outbound' and em.channel='gmail'
      join growth.source_evidence e on e.id::text=m.confirmed_snapshot->'sourceProof'->>'observationProofId' and e.prospect_id=p.id and e.claim_type='business_observation'
      where m.id=${identity.membershipId} for update of em`;
    if (!message) return held("follow_up_unavailable");
    if (job.status === "completed") {
      const prepared = z
        .object({ coverageId: z.uuid() })
        .safeParse(message.metadata);
      if (!prepared.success || prepared.data.coverageId !== input.coverageId)
        return held("job_replay_conflict");
      return {
        status: "ready",
        value: { messageId: message.id, step, alreadyExisted: true },
      };
    }
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (
      !clock ||
      job.status !== "leased" ||
      !job.leaseUntil ||
      job.leaseUntil <= clock.now ||
      job.dueAt > clock.now ||
      !message.scheduledFor ||
      message.scheduledFor.getTime() !== job.dueAt.getTime()
    )
      return held("job_lease_invalid");
    if (
      message.status !== "draft" ||
      message.metadata !== null ||
      message.subject !== null ||
      message.html !== null ||
      message.text !== null ||
      message.providerDraftId !== null ||
      message.memberStatus !== "active" ||
      message.sequenceStatus !== "active" ||
      message.excluded ||
      message.hasReply
    )
      return held("follow_up_excluded");
    const anchor = await loadFollowUpAnchor(tx, {
      membershipId: identity.membershipId,
      connectionId: input.connectionId,
      step,
    });
    if (
      !anchor ||
      anchor.googleSubject !== account.account.googleSubject ||
      !(await hasFollowUpReplyCoverage(tx, {
        connectionId: input.connectionId,
        googleSubject: anchor.googleSubject,
        submittedAt: anchor.submittedAt,
        coverageId: input.coverageId,
      }))
    )
      return held("reply_coverage_unknown");
    const proof = await loadPolicyAuthorizedSourceProof(tx, {
      membershipId: identity.membershipId,
      connectionId: input.connectionId,
      messageId: message.id,
    });
    const policy = campaignPolicyDefinitionSchema.safeParse(message.policy);
    if (
      !proof ||
      !policy.success ||
      !policy.data.offer ||
      !policy.data.jurisdiction ||
      proof.proof.observationProofId !==
        anchor.campaign.sourceProof.observationProofId ||
      message.currentPermission !== anchor.campaign.permissionId ||
      message.contactEmail !== anchor.campaign.effectiveRecipient.email ||
      message.contactVersion !==
        anchor.campaign.effectiveRecipient.contactVersion ||
      message.prospectVersion !==
        anchor.campaign.effectiveRecipient.prospectVersion ||
      JSON.stringify(policy.data.commercialTerms) !==
        JSON.stringify(anchor.campaign.commercialTerms)
    )
      return held("preparation_not_authorized");
    const copy = buildControlledFollowUp({
      campaignId: identity.campaignId,
      policyVersion: identity.policyVersion,
      businessId: identity.businessId,
      market: message.market,
      jurisdiction: policy.data.jurisdiction,
      businessName: message.businessName,
      observation: message.observation,
      offer: policy.data.offer,
      commercialTerms: policy.data.commercialTerms,
      variants: policy.data.variants,
      step,
    });
    if (
      !copy ||
      copy.subject !== anchor.subject ||
      copy.variantId !== anchor.campaign.variantId ||
      copy.variantVersion !== anchor.campaign.variantVersion ||
      anchor.campaign.campaignId !== identity.campaignId ||
      anchor.campaign.policyVersion !== identity.policyVersion ||
      anchor.campaign.businessId !== identity.businessId ||
      anchor.campaign.offer !== policy.data.offer ||
      anchor.campaign.market !== message.market
    )
      return held("copy_unavailable");
    const [finalClock] = await tx<
      { now: Date }[]
    >`select clock_timestamp() as now`;
    if (
      !finalClock ||
      finalClock.now >= job.leaseUntil ||
      finalClock.now >= proof.bounds.expiresAt ||
      finalClock.now < proof.bounds.validatedAt ||
      (proof.bounds.validThrough !== null &&
        finalClock.now > proof.bounds.validThrough)
    )
      return held("preparation_expired");
    const copySha256 = createHash("sha256")
      .update(JSON.stringify([copy.subject, copy.html, copy.text]))
      .digest("hex");
    await tx`update growth.email_messages set subject_snapshot=${copy.subject},html_snapshot=${copy.html},text_snapshot=${copy.text},controlled_preparation=${tx.json({ version: 1, variantId: copy.variantId, variantVersion: copy.variantVersion, observationProofId: proof.proof.observationProofId, permissionId: anchor.campaign.permissionId, copySha256, coverageId: input.coverageId })},status='queued',updated_at=clock_timestamp() where id=${message.id}`;
    await tx`update growth.outreach_jobs set status='completed',lease_until=null where id=${input.jobId}`;
    const event = randomUUID();
    await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${event},${identity.campaignId},${identity.policyVersion},${identity.membershipId},'follow_up_prepared')`;
    await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${event})`;
    await appendAuditEvent(tx, {
      correlationId: input.jobId,
      actorType: "system",
      actorId: "outreach-preparation",
      action: "campaign.follow_up_prepared",
      entityType: "campaign_membership",
      entityId: identity.membershipId,
    });
    return {
      status: "ready",
      value: { messageId: message.id, step, alreadyExisted: false },
    };
  });
}
