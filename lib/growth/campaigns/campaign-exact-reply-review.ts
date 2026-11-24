import { z } from "zod";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { parseGmailRecipients } from "../integrations/gmail/recipients";
import { parseGmailReferences } from "../sequences/gmail-references";
import { loadProvenReferences } from "../sequences/gmail-reference-attribution";
import type { CampaignCommand } from "./schemas";

type ReviewCommand = Extract<CampaignCommand, { type: "record_reply" }>;
const attributionSchema = z.strictObject({
  basis: z.literal("gmail_exact_reference_v1"),
  outboundProvider: z.enum(["gmail", "resend"]),
  reservationId: z.uuid(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  googleSubject: z.string().trim().min(1).max(512),
  grantEpoch: z.number().int().positive(),
  recipient: z.email(),
});
const monitorScopesSchema = z.object({
  monitoredMailbox: z.object({ grantedScopes: z.array(z.string()).min(1) }),
});

export async function loadExactReplyReviewContext(
  tx: GrowthTransaction,
  command: ReviewCommand,
  founder: FounderSession,
) {
  const [initial] = await tx<
    { campaignId: string; businessId: string; attribution: unknown }[]
  >`
    select m.campaign_id as "campaignId",m.business_id as "businessId",e.outreach_reply_attribution as attribution
    from growth.campaign_memberships m join growth.email_messages em on em.sequence_enrollment_id=m.sequence_id
    join growth.email_events e on e.email_message_id=em.id and e.provider='gmail' and e.provider_event_id=em.provider_message_id
    where m.id=${command.membershipId} and em.id=${command.inboundMessageId}`;
  const proof = attributionSchema.safeParse(initial?.attribution);
  if (!initial || !proof.success) throw new Error("reply_evidence_unavailable");
  const reference = parseGmailReferences(proof.data.rfcMessageId, null);
  if (reference.kind !== "valid" || reference.ids.length !== 1)
    throw new Error("reply_evidence_unavailable");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${initial.campaignId}`},0))`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${initial.businessId}`},0))`;
  const [mailbox] = await tx<
    { subject: string | null; address: string; version: number }[]
  >`select google_subject as subject,subject_email as address,version from growth.integration_connections where id=${proof.data.connectionId} and provider='gmail' for share`;
  if (
    !mailbox ||
    mailbox.subject !== proof.data.googleSubject ||
    mailbox.address !== founder.email ||
    mailbox.version < proof.data.grantEpoch
  )
    throw new Error("review_context_changed");
  const [member] = await tx<
    {
      campaignId: string;
      businessId: string;
      version: number;
      sequenceId: string;
      prospectId: string;
      contactId: string;
      status: string;
      prospectVersion: number;
      contactVersion: number;
      policyProvider: string;
      policyConnectionId: string;
    }[]
  >`
    select m.campaign_id as "campaignId",m.business_id as "businessId",m.policy_version as version,m.sequence_id as "sequenceId",m.prospect_id as "prospectId",ct.id as "contactId",m.status,p.version as "prospectVersion",ct.version as "contactVersion",policy.policy->>'provider' as "policyProvider",policy.account_connection_id as "policyConnectionId"
    from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
    join growth.contacts ct on ct.id=p.primary_contact_id join growth.campaigns policy on policy.id=m.campaign_id and policy.version=m.policy_version
    where m.id=${command.membershipId} and policy.policy->>'accountConnectionId'=policy.account_connection_id::text for update of m,p for share of ct,policy`;
  if (
    !member ||
    member.campaignId !== initial.campaignId ||
    member.businessId !== initial.businessId ||
    !["review", "active", "paused", "replied"].includes(member.status) ||
    member.version !== command.expectedPolicyVersion ||
    member.prospectVersion !== command.expectedProspectVersion ||
    member.contactVersion !== command.expectedContactVersion ||
    member.policyProvider !== proof.data.outboundProvider
  )
    throw new Error("review_context_changed");
  const [sequence] = await tx<
    { status: string }[]
  >`select status from growth.sequence_enrollments where id=${member.sequenceId} and prospect_id=${member.prospectId} and contact_id=${member.contactId} for update`;
  if (!sequence) throw new Error("review_context_changed");
  const [message] = await tx<
    {
      receivedAt: Date;
      duplicate: boolean;
      attribution: unknown;
      reservationId: string | null;
      from: unknown;
    }[]
  >`
    select em.received_at as "receivedAt",exists(select 1 from growth.outreach_events e where e.review_inbound_message_id=em.id) as duplicate,
      ev.outreach_reply_attribution as attribution,ev.outreach_reply_reservation_id as "reservationId",ev.sanitised_payload->'from' as "from"
    from growth.email_messages em join growth.email_events ev on ev.email_message_id=em.id and ev.provider='gmail' and ev.provider_event_id=em.provider_message_id and ev.event_type in ('reply','auto_response')
    where em.id=${command.inboundMessageId} and em.sequence_enrollment_id=${member.sequenceId} and em.prospect_id=${member.prospectId} and em.contact_id=${member.contactId}
      and em.channel='gmail' and em.direction='inbound' and em.status='received' and em.provider_message_id is not null and em.provider_thread_id is not null and em.received_at is not null for share of em,ev`;
  const stored = attributionSchema.safeParse(message?.attribution);
  const from =
    typeof message?.from === "string"
      ? parseGmailRecipients({ to: message.from, cc: null, bcc: null })
      : null;
  if (
    !message ||
    message.duplicate ||
    message.receivedAt > new Date() ||
    !stored.success ||
    JSON.stringify(stored.data) !== JSON.stringify(proof.data) ||
    message.reservationId !== proof.data.reservationId ||
    !from ||
    from.to.length !== 1 ||
    from.to[0] !== proof.data.recipient
  )
    throw new Error("reply_evidence_unavailable");
  const [source] = await tx<
    { snapshot: unknown }[]
  >`select issued_snapshot as snapshot from growth.outreach_reservations where id=${proof.data.reservationId} and membership_id=${command.membershipId} and sequence_id=${member.sequenceId} and connection_id=${member.policyConnectionId} and status='accepted' and confirmation_observed_at is not null for share`;
  if (!source) throw new Error("reply_evidence_unavailable");
  const monitor = monitorScopesSchema.safeParse(source.snapshot);
  if (proof.data.outboundProvider === "resend" && !monitor.success)
    throw new Error("reply_evidence_unavailable");
  const candidates = await loadProvenReferences(
    tx,
    [proof.data.rfcMessageId],
    proof.data.recipient,
    {
      connectionId: proof.data.connectionId,
      googleSubject: proof.data.googleSubject,
      grantEpoch: proof.data.grantEpoch,
      grantedScopes: monitor.success
        ? monitor.data.monitoredMailbox.grantedScopes
        : [],
    },
    mailbox.address,
  );
  if (
    candidates.length !== 1 ||
    candidates[0]?.attribution.reservationId !== proof.data.reservationId ||
    candidates[0].enrollment.id !== member.sequenceId ||
    JSON.stringify(candidates[0].attribution) !== JSON.stringify(proof.data)
  )
    throw new Error("reply_evidence_ambiguous");
  const [membership] = await tx<
    { count: number }[]
  >`select count(*)::int as count from growth.campaign_memberships where sequence_id=${member.sequenceId}`;
  if (membership?.count !== 1) throw new Error("reply_evidence_ambiguous");
  return {
    campaignId: member.campaignId,
    version: member.version,
    sequenceId: member.sequenceId,
    sequenceStatus: sequence.status,
  };
}
