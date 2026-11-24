import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { createSequenceStopTransaction } from "../sequences/stop-repository";
import { stopSequenceInTransaction } from "../sequences/stop";
import { cancelCampaignJobs } from "./lifecycle";
import type { CampaignMutation } from "./events";
import type { CampaignCommand } from "./schemas";

type OutcomeCommand = Extract<CampaignCommand, { type: "record_outcome" }>;

export async function reviewCampaignOutcome(
  tx: GrowthTransaction,
  command: OutcomeCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<CampaignMutation> {
  const [identity] = await tx<{ campaignId: string; businessId: string }[]>`
    select campaign_id as "campaignId",business_id as "businessId" from growth.campaign_memberships where id=${command.membershipId}`;
  if (!identity) throw new Error("membership_unavailable");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
  const [member] = await tx<
    {
      campaignId: string;
      businessId: string;
      prospectId: string;
      contactId: string;
      version: number;
      prospectVersion: number;
      contactVersion: number;
      sequenceId: string;
      status: string;
      submittedAt: Date;
      bounded: boolean;
    }[]
  >`
    select m.campaign_id as "campaignId",m.business_id as "businessId",m.prospect_id as "prospectId",
      p.primary_contact_id as "contactId",m.policy_version as version,p.version as "prospectVersion",c.version as "contactVersion",
      m.sequence_id as "sequenceId",m.status,r.submitted_at as "submittedAt",
      coalesce(r.confirmation_receipt->>'basis' in ('gmail_fss_sent_observed','resend_fss_delivery_observed')
        and r.direct_submission_evidence is not null and r.confirmation_observed_at is not null
        and r.confirmation_receipt->>'possibleInvocationFrom'=to_char(date_trunc('milliseconds',r.submitted_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        and (r.confirmation_receipt->>'basis'<>'gmail_fss_sent_observed' or em.outreach_guarded_claim),false) as bounded
    from growth.campaign_memberships m
    join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
    join growth.contacts c on c.id=p.primary_contact_id
    join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id and se.contact_id=c.id
    join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id and r.sequence_id=m.sequence_id
    join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=m.sequence_id
    where m.id=${command.membershipId} for update of m,p`;
  if (
    !member ||
    member.campaignId !== identity.campaignId ||
    member.businessId !== identity.businessId ||
    member.version !== command.expectedPolicyVersion ||
    member.prospectVersion !== command.expectedProspectVersion ||
    member.contactVersion !== command.expectedContactVersion ||
    !member.bounded
  )
    throw new Error("outcome_context_changed");
  const [contact] = await tx<
    { version: number }[]
  >`select version from growth.contacts where id=${member.contactId} for share`;
  if (!contact || contact.version !== command.expectedContactVersion)
    throw new Error("outcome_context_changed");
  const [sequence] = await tx<
    { status: string }[]
  >`select status from growth.sequence_enrollments where id=${member.sequenceId} and prospect_id=${member.prospectId} and contact_id=${member.contactId} for update`;
  if (!sequence) throw new Error("outcome_context_changed");
  let occurredAt: Date;
  let sourceId: string;
  if (command.outcome.kind === "meeting") {
    const [source] = await tx<{ id: string; validTime: boolean }[]>`
      select a.id,${command.outcome.occurredAt}::timestamptz <= clock_timestamp()
        and ${command.outcome.occurredAt}::timestamptz >= r.submitted_at as "validTime"
      from growth.crm_activities a join growth.outreach_reservations r on r.id=(select first_confirmation_reservation_id from growth.campaign_memberships where id=${command.membershipId})
      where a.id=${command.outcome.crmActivityId} and a.prospect_id=${member.prospectId} and a.activity_type='meeting'`;
    if (!source?.validTime) throw new Error("outcome_evidence_unavailable");
    occurredAt = command.outcome.occurredAt;
    sourceId = source.id;
  } else {
    const [source] = await tx<
      { id: string; occurredAt: Date; validTime: boolean }[]
    >`
      select ev.id,ev.occurred_at as "occurredAt",ev.occurred_at<=clock_timestamp() and ev.occurred_at>=r.submitted_at as "validTime"
      from growth.commercial_stage_events ev join growth.delivery_engagements de on de.id=ev.engagement_id
      join growth.outreach_reservations r on r.id=(select first_confirmation_reservation_id from growth.campaign_memberships where id=${command.membershipId})
      where ev.id=${command.outcome.stageEventId} and de.id=${command.outcome.engagementId} and de.prospect_id=${member.prospectId}
        and ev.dimension='commercial' and ev.to_state='proposal' for share of de`;
    if (!source?.validTime) throw new Error("outcome_evidence_unavailable");
    occurredAt = source.occurredAt;
    sourceId = source.id;
  }
  const [duplicate] = await tx<
    { found: boolean }[]
  >`select exists(select 1 from growth.outreach_events where review_meeting_activity_id=${sourceId}::uuid or review_proposal_event_id=${sourceId}::uuid) as found`;
  if (duplicate?.found) throw new Error("outcome_evidence_attributed");
  const stop = createSequenceStopTransaction(tx);
  if (["pending_approval", "active", "paused"].includes(sequence.status)) {
    await stopSequenceInTransaction(stop, {
      sequenceId: member.sequenceId,
      reason: "started_talks",
      actor: founder,
      correlationId,
    });
  } else {
    if (!(await stop.lockEnrollment(member.sequenceId)))
      throw new Error("outcome_context_changed");
    await stop.cancelPendingMessages(member.sequenceId);
  }
  await cancelCampaignJobs(tx, member.campaignId, command.membershipId);
  await tx`update growth.campaign_memberships set status='stopped',updated_at=clock_timestamp() where id=${command.membershipId} and status in ('review','active','paused')`;
  return {
    campaignId: member.campaignId,
    version: member.version,
    membershipId: command.membershipId,
    resultId: sourceId,
    outcomeOccurredAt: occurredAt,
  };
}
