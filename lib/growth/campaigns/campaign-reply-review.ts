import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { createSequenceStopTransaction } from "../sequences/stop-repository";
import { stopSequenceInTransaction } from "../sequences/stop";
import { matchesDirectSubmissionEvidence } from "./direct-submission-evidence";
import { cancelCampaignJobs } from "./lifecycle";
import type { CampaignCommand } from "./schemas";
import type { CampaignMutation } from "./events";

type ReviewCommand = Extract<CampaignCommand, { type: "record_reply" }>;

export async function reviewCampaignReply(
  tx: GrowthTransaction,
  command: ReviewCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<CampaignMutation> {
  const [identity] = await tx<{ campaignId: string; businessId: string }[]>`
    select campaign_id as "campaignId",business_id as "businessId"
    from growth.campaign_memberships where id=${command.membershipId}`;
  if (!identity) throw new Error("membership_unavailable");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
  const [member] = await tx<
    {
      campaignId: string;
      version: number;
      sequenceId: string | null;
      prospectId: string;
      businessId: string;
      status: string;
      contactId: string | null;
      prospectVersion: number;
      contactVersion: number | null;
      sequenceStatus: string | null;
    }[]
  >`
    select m.campaign_id as "campaignId",m.policy_version as version,m.sequence_id as "sequenceId",
      m.prospect_id as "prospectId",m.business_id as "businessId",m.status,
      p.primary_contact_id as "contactId",p.version as "prospectVersion",ct.version as "contactVersion",
      se.status as "sequenceStatus"
    from growth.campaign_memberships m
    join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
    left join growth.contacts ct on ct.id=p.primary_contact_id
    left join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id and se.contact_id=ct.id
    where m.id=${command.membershipId}
    for update of m,p`;
  if (
    !member ||
    member.campaignId !== identity.campaignId ||
    member.businessId !== identity.businessId ||
    !member.sequenceId ||
    !member.contactId ||
    !member.sequenceStatus ||
    member.version !== command.expectedPolicyVersion ||
    member.prospectVersion !== command.expectedProspectVersion ||
    member.contactVersion !== command.expectedContactVersion
  )
    throw new Error("review_context_changed");
  const [contact] = await tx<{ version: number }[]>`
    select version from growth.contacts where id=${member.contactId} for share`;
  if (!contact || contact.version !== command.expectedContactVersion)
    throw new Error("review_context_changed");
  const [message] = await tx<
    {
      providerMessageId: string;
      threadId: string;
      receivedAt: Date;
      duplicate: boolean;
    }[]
  >`
    select em.provider_message_id as "providerMessageId",em.provider_thread_id as "threadId",
      em.received_at as "receivedAt",
      exists(select 1 from growth.outreach_events e where e.review_inbound_message_id=em.id) as duplicate
    from growth.email_messages em
    join growth.email_events ev on ev.email_message_id=em.id and ev.provider='gmail'
      and ev.provider_event_id=em.provider_message_id and ev.event_type in ('reply','auto_response')
    where em.id=${command.inboundMessageId} and em.sequence_enrollment_id=${member.sequenceId}
      and em.prospect_id=${member.prospectId} and em.contact_id=${member.contactId}
      and em.channel='gmail' and em.direction='inbound' and em.status='received'
      and em.provider_message_id is not null and em.provider_thread_id is not null and em.received_at is not null
    for share of em`;
  if (!message || message.duplicate || message.receivedAt > new Date())
    throw new Error("reply_evidence_unavailable");
  const issuers = await tx<
    {
      id: string;
      accountId: string;
      connectionId: string;
      grantEpoch: number;
      rfc: string;
      hash: string;
      providerId: string;
      threadId: string;
      snapshot: { googleSubject?: unknown };
      evidence: unknown;
    }[]
  >`
    select r.id,r.account_id as "accountId",r.connection_id as "connectionId",r.grant_epoch as "grantEpoch",
      r.rfc_message_id as rfc,r.issued_snapshot_hash as hash,r.provider_message_id as "providerId",
      r.provider_thread_id as "threadId",r.issued_snapshot as snapshot,r.direct_submission_evidence as evidence
    from growth.outreach_reservations r
    where r.membership_id=${command.membershipId} and r.sequence_id=${member.sequenceId}
      and r.status='accepted' and r.provider_thread_id=${message.threadId}
      and r.direct_submission_evidence is not null
    for share of r`;
  const supported = issuers.some((row) =>
    matchesDirectSubmissionEvidence(row.evidence, {
      version: 1,
      kind: "gmail_api_send_message_v1",
      reservationId: row.id,
      accountId: row.accountId,
      connectionId: row.connectionId,
      googleSubject: row.snapshot?.googleSubject,
      grantEpoch: row.grantEpoch,
      rfcMessageId: row.rfc,
      rawSha256: row.hash,
      providerMessageId: row.providerId,
      providerThreadId: row.threadId,
    }),
  );
  if (!supported) throw new Error("reply_evidence_unavailable");
  const [attribution] = await tx<{ count: number }[]>`
    select count(*)::int as count from growth.campaign_memberships
    where sequence_id=${member.sequenceId}`;
  if (attribution?.count !== 1) throw new Error("reply_evidence_ambiguous");

  if (command.kind !== "bot" && command.kind !== "out_of_office") {
    const stop = createSequenceStopTransaction(tx);
    if (
      ["pending_approval", "active", "paused"].includes(member.sequenceStatus)
    ) {
      await stopSequenceInTransaction(stop, {
        sequenceId: member.sequenceId,
        reason: command.kind === "opt_out" ? "do_not_contact" : "reply",
        actor: founder,
        correlationId,
      });
    } else {
      const enrollment = await stop.lockEnrollment(member.sequenceId);
      if (!enrollment) throw new Error("review_context_changed");
      await stop.cancelPendingMessages(member.sequenceId);
      if (command.kind === "opt_out") {
        const inserted = await stop.insertDoNotContactSuppression({
          normalisedEmail: enrollment.normalisedEmail,
          businessId: enrollment.businessId,
          reason: "do_not_contact",
          source: "founder",
          createdBy: founder.actorId,
        });
        if (inserted)
          await stop.appendStopAudit({
            correlationId,
            actorType: "founder",
            actorId: founder.actorId,
            sequenceId: member.sequenceId,
            reason: "do_not_contact",
          });
      }
    }
    await cancelCampaignJobs(tx, member.campaignId, command.membershipId);
    await tx`update growth.campaign_memberships set status='replied',updated_at=clock_timestamp()
      where id=${command.membershipId} and status in ('active','paused','review')`;
  }
  return {
    campaignId: member.campaignId,
    version: member.version,
    membershipId: command.membershipId,
    resultId: command.inboundMessageId,
  };
}
