import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { loadPolicyAuthorizedSourceProof } from "./founder-verification-reader";
import { validateCampaignDefinition } from "./lifecycle";
import { campaignPolicyDefinitionSchema } from "./schemas";

export type CanonicalOutreachPreparation = {
  messageId: string;
  sequenceId: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  gmailThreadId: string | null;
  references: string[];
  fingerprint: string;
};
export type PreparationDecision =
  | { status: "ready"; preparation: CanonicalOutreachPreparation }
  | { status: "held"; reason: string };

type LockedMessage = {
  messageId: string;
  sequenceId: string;
  prospectId: string;
  contactId: string;
  subject: string | null;
  emailAssetId: string | null;
  templateSnapshot: unknown;
  html: string | null;
  text: string | null;
  recipient: string;
  normalizedEmail: string;
  contactVersion: number;
  businessVersion: number;
  prospectVersion: number;
  lawfulBasis: string;
  subscriberType: string;
  prospectStatus: string;
  corporateStatus: string;
  countryCode: string;
  enrollmentStatus: string;
  followUpPolicy: string | null;
  approvedRecipient: string | null;
  gmailThreadId: string | null;
  messageStatus: string;
  leaseToken: string | null;
  leaseUntil: Date | null;
  claimPreviousStatus: string | null;
  stepNumber: number;
  isClient: boolean;
  suppressed: boolean;
  hasReply: boolean;
};

// Caller locks connection, policy, membership, prospect, contact, sequence and message in order.
export async function loadCanonicalOutreachPreparation(
  tx: GrowthTransaction,
  input: {
    messageId: string;
    leaseToken: string;
    connectionId: string;
    grantEpoch: number;
    now: Date;
  },
): Promise<PreparationDecision> {
  const held = (reason: string): PreparationDecision => ({
    status: "held",
    reason,
  });
  const [row] = await tx<LockedMessage[]>`
    select em.id as "messageId",se.id as "sequenceId",p.id as "prospectId",ct.id as "contactId",
      em.subject_snapshot as subject,em.email_asset_id as "emailAssetId",se.template_snapshot as "templateSnapshot",em.html_snapshot as html,em.text_snapshot as text,
      ct.email as recipient,ct.normalised_email as "normalizedEmail",ct.version as "contactVersion",b.version as "businessVersion",
      p.version as "prospectVersion",ct.lawful_basis as "lawfulBasis",ct.subscriber_type as "subscriberType",
      p.status as "prospectStatus",b.corporate_status as "corporateStatus",b.country_code as "countryCode",se.status as "enrollmentStatus",
      se.template_snapshot->>'followUpPolicy' as "followUpPolicy",se.template_snapshot->>'approvedRecipient' as "approvedRecipient",
      se.gmail_thread_id as "gmailThreadId",em.status as "messageStatus",em.lease_token as "leaseToken",
      em.lease_expires_at as "leaseUntil",em.outreach_claim_previous_status as "claimPreviousStatus",em.step_number as "stepNumber",growth.is_outreach_client(p.id) as "isClient",
      exists(select 1 from growth.suppressions s where s.normalised_email=ct.normalised_email or s.business_id=p.business_id) as suppressed,
      exists(select 1 from growth.email_messages incoming where incoming.sequence_enrollment_id=se.id and incoming.direction='inbound' and incoming.received_at>coalesce((select max(sent_at) from growth.email_messages outgoing where outgoing.sequence_enrollment_id=se.id and outgoing.direction='outbound' and outgoing.status='sent'),'-infinity'::timestamptz)) as "hasReply"
    from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
    join growth.prospects p on p.id=se.prospect_id join growth.contacts ct on ct.id=se.contact_id
    join growth.businesses b on b.id=p.business_id
    where em.id=${input.messageId} and em.channel='gmail' and em.direction='outbound'
  `;
  if (
    !row ||
    row.messageStatus !== "sending" ||
    row.leaseToken !== input.leaseToken ||
    !row.leaseUntil ||
    row.leaseUntil <= input.now
  )
    return held("lease_invalid");
  if (!row.subject || !row.html || !row.text) return held("message_unprepared");
  if (
    row.enrollmentStatus !== "active" ||
    row.isClient ||
    row.suppressed ||
    row.hasReply
  )
    return held("outreach_excluded");
  if (
    row.followUpPolicy === "manual_only" &&
    (row.approvedRecipient !== row.normalizedEmail ||
      row.corporateStatus !== "active" ||
      !["ready_for_email_review", "contacted"].includes(row.prospectStatus) ||
      !(
        row.lawfulBasis === "consent" ||
        (row.lawfulBasis === "legitimate_interests" &&
          row.subscriberType === "corporate")
      ))
  )
    return held("research_permission_changed");
  const memberships = await tx<
    {
      id: string;
      version: number;
      policy: unknown;
      approvedAt: Date | null;
      approvedBy: string | null;
      status: string;
      accountId: string | null;
      permissionId: string | null;
      permission: unknown;
      basis: string | null;
      provider: string | null;
      jurisdiction: string | null;
      expiresAt: Date | null;
    }[]
  >`
    select m.id,m.policy_version as version,c.policy,c.approved_at as "approvedAt",c.approved_by as "approvedBy",c.status,c.account_connection_id as "accountId",p.id as "permissionId",p.evidence as permission,p.basis,p.provider,p.jurisdiction,p.expires_at as "expiresAt"
    from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    left join growth.outreach_permissions p on p.id=m.current_permission_id and p.membership_id=m.id
    where m.sequence_id=${row.sequenceId}
  `;
  if (memberships.length > 1) return held("membership_ambiguous");
  if (memberships.length === 0 && row.approvedRecipient !== row.normalizedEmail)
    return held("legacy_approval_unbound");
  let campaignAuthority: unknown = null;
  if (memberships.length === 1) {
    const member = memberships[0];
    if (!member) return held("membership_ambiguous");
    const parsed = campaignPolicyDefinitionSchema.safeParse(member.policy);
    if (
      !parsed.success ||
      member.status !== "approved" ||
      !member.approvedAt ||
      member.approvedAt > input.now ||
      !member.approvedBy ||
      member.accountId !== input.connectionId
    )
      return held("policy_not_authorized");
    try {
      validateCampaignDefinition(parsed.data, member.version, input.now, true);
    } catch {
      return held("policy_not_authorized");
    }
    if (
      !member.permissionId ||
      member.provider !== "gmail" ||
      member.basis !== parsed.data.permissionRequirement ||
      member.jurisdiction !== parsed.data.jurisdiction ||
      !member.expiresAt ||
      member.expiresAt <= input.now
    )
      return held("permission_invalid");
    const evidence = z
      .object({
        observedAt: z.iso.datetime(),
        explicitOptIn: z.boolean(),
        summary: z.string().trim().min(1),
        reference: z.object({
          kind: z.enum(["private", "public"]),
          value: z.string().trim().min(1),
        }),
      })
      .safeParse(member.permission);
    if (
      !evidence.success ||
      new Date(evidence.data.observedAt) > input.now ||
      (member.basis === "consent" && !evidence.data.explicitOptIn) ||
      member.jurisdiction !== row.countryCode
    )
      return held("permission_invalid");
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: parsed.data.recipientTimezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(input.now);
    const day =
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
        local.find((part) => part.type === "weekday")?.value ?? "",
      ) + 1;
    const time = `${local.find((part) => part.type === "hour")?.value}:${local.find((part) => part.type === "minute")?.value}`;
    if (
      !parsed.data.sendWeekdays.includes(day) ||
      time < parsed.data.windowStart ||
      time >= parsed.data.windowEnd
    )
      return held("outside_window");
    const proof = await loadPolicyAuthorizedSourceProof(tx, {
      membershipId: member.id,
      messageId: row.messageId,
      connectionId: input.connectionId,
    });
    if (!proof) return held("verification_required");
    campaignAuthority = { member, proof };
  }
  const references =
    row.stepNumber === 0
      ? []
      : (
          await tx<
            { rfc: string }[]
          >`select rfc_message_id as rfc from growth.email_messages where sequence_enrollment_id=${row.sequenceId} and direction='outbound' and status='sent' and rfc_message_id is not null order by step_number asc limit 51`
        ).map((item) => item.rfc);
  if (row.stepNumber === 0 && row.gmailThreadId)
    return held("first_message_already_threaded");
  if (references.length > 50) return held("thread_references_overflow");
  if (row.stepNumber !== 0 && (!row.gmailThreadId || references.length === 0))
    return held("thread_unknown");
  const canonical = {
    messageId: row.messageId,
    sequenceId: row.sequenceId,
    recipient: row.recipient,
    subject: row.subject,
    emailAssetId: row.emailAssetId,
    templateSnapshot: row.templateSnapshot,
    html: row.html,
    text: row.text,
    gmailThreadId: row.gmailThreadId,
    references,
    normalizedEmail: row.normalizedEmail,
    prospectVersion: row.prospectVersion,
    contactVersion: row.contactVersion,
    businessVersion: row.businessVersion,
    leaseUntil: row.leaseUntil,
    leaseToken: row.leaseToken,
    claimPreviousStatus: row.claimPreviousStatus,
    connectionId: input.connectionId,
    grantEpoch: input.grantEpoch,
    campaignAuthority,
  };
  return {
    status: "ready",
    preparation: {
      messageId: row.messageId,
      sequenceId: row.sequenceId,
      recipient: row.recipient,
      subject: row.subject,
      html: row.html,
      text: row.text,
      gmailThreadId: row.gmailThreadId,
      references,
      fingerprint: createHash("sha256")
        .update(JSON.stringify(canonical))
        .digest("hex"),
    },
  };
}
