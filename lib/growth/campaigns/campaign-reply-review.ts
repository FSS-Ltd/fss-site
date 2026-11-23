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
  const [identity] = await tx<
    { campaignId: string; businessId: string; connectionId: string | null }[]
  >`
    select m.campaign_id as "campaignId",m.business_id as "businessId",policy.account_connection_id as "connectionId"
    from growth.campaign_memberships m join growth.campaigns policy on policy.id=m.campaign_id and policy.version=m.policy_version and policy.policy->>'provider'='gmail' and policy.policy->>'accountConnectionId'=policy.account_connection_id::text
    where m.id=${command.membershipId}`;
  if (!identity) throw new Error("membership_unavailable");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
  // Match reservation locking order: account connection, control, then member and sequence.
  const [account] = await tx<{ id: string; subject: string }[]>`
    select id,google_subject as subject from growth.integration_connections
    where id=${identity.connectionId} and provider='gmail' and subject_email=${founder.email} and google_subject is not null for share`;
  if (!account) throw new Error("review_context_changed");
  const [control] = await tx<{ connectionId: string }[]>`
    select connection_id as "connectionId" from growth.outreach_account_controls
    where connection_id=${account.id} and provider='gmail' and verified_subject=${account.subject} for share`;
  if (!control) throw new Error("review_context_changed");
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
    }[]
  >`
    select m.campaign_id as "campaignId",m.policy_version as version,m.sequence_id as "sequenceId",
      m.prospect_id as "prospectId",m.business_id as "businessId",m.status,
      p.primary_contact_id as "contactId",p.version as "prospectVersion",ct.version as "contactVersion"
    from growth.campaign_memberships m
    join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
    left join growth.contacts ct on ct.id=p.primary_contact_id
    join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id and se.contact_id=ct.id
    join growth.campaigns policy on policy.id=m.campaign_id and policy.version=m.policy_version and policy.policy->>'provider'='gmail' and policy.policy->>'accountConnectionId'=policy.account_connection_id::text and policy.account_connection_id=${account.id}
    where m.id=${command.membershipId}
    for update of m,p`;
  if (
    !member ||
    member.campaignId !== identity.campaignId ||
    member.businessId !== identity.businessId ||
    !member.sequenceId ||
    !member.contactId ||
    !["review", "active", "paused", "replied"].includes(member.status) ||
    member.version !== command.expectedPolicyVersion ||
    member.prospectVersion !== command.expectedProspectVersion ||
    member.contactVersion !== command.expectedContactVersion
  )
    throw new Error("review_context_changed");
  const [contact] = await tx<{ version: number }[]>`
    select version from growth.contacts where id=${member.contactId} for share`;
  if (!contact || contact.version !== command.expectedContactVersion)
    throw new Error("review_context_changed");
  const [sequence] = await tx<{ status: string; thread: string | null }[]>`
    select status,gmail_thread_id as thread from growth.sequence_enrollments
    where id=${member.sequenceId} and prospect_id=${member.prospectId} and contact_id=${member.contactId} for update`;
  if (!sequence) throw new Error("review_context_changed");
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
  if (
    !message ||
    message.duplicate ||
    message.receivedAt > new Date() ||
    !sequence.thread ||
    sequence.thread !== message.threadId
  )
    throw new Error("reply_evidence_unavailable");
  const [thread] = await tx<{ count: number; conflicting: boolean }[]>`
    select (select count(*)::int from growth.sequence_enrollments where gmail_thread_id=${message.threadId}) as count,
      exists(select 1 from growth.outreach_reservations r where r.provider_thread_id=${message.threadId}
        and (r.connection_id is distinct from ${account.id}::uuid or r.sequence_id is distinct from ${member.sequenceId}::uuid)) as conflicting`;
  if (!thread || thread.count !== 1 || thread.conflicting)
    throw new Error("reply_evidence_ambiguous");
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
      and r.connection_id=${account.id} and r.direct_submission_evidence is not null
    order by r.reserved_at desc,r.id limit 6 for share of r`;
  if (issuers.length > 5) throw new Error("reply_evidence_ambiguous");
  const supported = issuers.some(
    (row) =>
      row.snapshot?.googleSubject === account.subject &&
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
    if (["pending_approval", "active", "paused"].includes(sequence.status)) {
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
