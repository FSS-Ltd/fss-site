import { createHash } from "node:crypto";
import { z } from "zod";
import { TZDateMini } from "@date-fns/tz";
import {
  hasCompleteReplyCoverage,
  type ReplyCoverageInterval,
} from "../sequences/gmail-sync-coverage";
import type { GrowthTransaction } from "../db/types";
import { campaignSchema } from "./gmail-confirmation-campaign";
import { matchesDirectSubmissionEvidence } from "./direct-submission-evidence";
import { campaignPolicySchema, type CampaignReportInput } from "./schemas";

const receiptSchema = z.object({
  basis: z.literal("gmail_fss_sent_observed"),
  providerMessageId: z.string().min(1),
  providerThreadId: z.string().min(1),
  rfcMessageId: z.string().min(1),
  googleSubject: z.string().min(1),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedUntil: z.iso.datetime(),
  possibleInvocationFrom: z.iso.datetime().nullable().optional(),
});
const issuedSchema = z.object({
  raw: z.string().min(1),
  rawSha256: z.string(),
  googleSubject: z.string(),
  connectionId: z.uuid(),
  grantEpoch: z.number().int().positive(),
  rfcMessageId: z.string(),
  sequenceId: z.uuid(),
  membershipId: z.uuid(),
  campaign: campaignSchema,
});
type ConfirmationRow = {
  membershipId: string;
  campaignId: string;
  businessId: string;
  policyVersion: number;
  sequenceId: string;
  confirmedSnapshot: unknown;
  policy: unknown;
  reservationId: string;
  accountId: string;
  connectionId: string;
  grantEpoch: number;
  rfc: string;
  providerId: string;
  threadId: string;
  hash: string;
  snapshot: unknown;
  receipt: unknown;
  directEvidence: unknown;
  observedAt: Date;
  submittedAt: Date | null;
  guardedClaim: boolean;
};
export function projectConfirmation(
  row: ConfirmationRow,
): CampaignReportInput["members"][number] | null {
  const issued = issuedSchema.safeParse(row.snapshot);
  const receipt = receiptSchema.safeParse(row.receipt);
  const policy = campaignPolicySchema.safeParse(row.policy);
  if (!issued.success || !receipt.success || !policy.success) return null;
  const s = issued.data,
    c = s.campaign,
    r = receipt.data;
  const raw = Buffer.from(s.raw, "base64url");
  const variant = policy.data.variants.find(
    (v) => v.id === c.variantId && v.version === c.variantVersion,
  );
  if (
    !variant ||
    s.membershipId !== row.membershipId ||
    c.membershipId !== row.membershipId ||
    policy.data.version !== c.policyVersion ||
    policy.data.offer !== c.offer ||
    JSON.stringify(policy.data.commercialTerms ?? null) !==
      JSON.stringify(c.commercialTerms ?? null) ||
    c.campaignId !== row.campaignId ||
    c.businessId !== row.businessId ||
    c.policyVersion !== row.policyVersion ||
    s.sequenceId !== row.sequenceId ||
    JSON.stringify(c) !==
      JSON.stringify(campaignSchema.safeParse(row.confirmedSnapshot).data) ||
    s.connectionId !== row.connectionId ||
    s.grantEpoch !== row.grantEpoch ||
    s.rfcMessageId !== row.rfc ||
    s.rawSha256 !== row.hash ||
    r.rawSha256 !== row.hash ||
    raw.toString("base64url") !== s.raw ||
    createHash("sha256").update(raw).digest("hex") !== row.hash ||
    r.googleSubject !== s.googleSubject ||
    r.providerMessageId !== row.providerId ||
    r.providerThreadId !== row.threadId ||
    r.rfcMessageId !== row.rfc ||
    new Date(r.observedUntil).getTime() !== row.observedAt.getTime() ||
    (r.possibleInvocationFrom != null &&
      (!row.guardedClaim ||
        !row.submittedAt ||
        new Date(r.possibleInvocationFrom).getTime() !==
          row.submittedAt.getTime())) ||
    !matchesDirectSubmissionEvidence(row.directEvidence, {
      version: 1,
      kind: "gmail_api_send_message_v1",
      reservationId: row.reservationId,
      accountId: row.accountId,
      connectionId: row.connectionId,
      googleSubject: s.googleSubject,
      grantEpoch: row.grantEpoch,
      rfcMessageId: row.rfc,
      rawSha256: row.hash,
      providerMessageId: row.providerId,
      providerThreadId: row.threadId,
    })
  )
    return null;
  return {
    membershipId: row.membershipId,
    businessId: row.businessId,
    market: c.market,
    offer: c.offer,
    policyVersion: c.policyVersion,
    variantId: c.variantId,
    variantVersion: c.variantVersion,
    cta: variant.cta,
    // Neither a shared copy-family identity nor historical commit evidence is frozen today.
    comparisonFingerprint: null,
    commercialTermsFingerprint: c.commercialTerms
      ? createHash("sha256")
          .update(JSON.stringify(c.commercialTerms))
          .digest("hex")
      : null,
    confirmation: {
      basis: r.basis,
      observedAt: row.observedAt,
      possibleInvocationFrom: r.possibleInvocationFrom
        ? new Date(r.possibleInvocationFrom)
        : null,
    },
    replyCoverage: "unknown",
    meetingObservation: "unknown",
    paymentObservation: "unknown",
    replies: [],
    outcomes: [],
  };
}

export async function loadReportEvidence(
  tx: GrowthTransaction,
  campaignId: string,
  cutoff: Date,
): Promise<{
  members: CampaignReportInput["members"];
  unsupported: number;
  observedCompleteAtRead: number;
  sourceReceiptIds: string[];
  sourceReplyIds: string[];
  sourceCoverageIds: string[];
  lateReviewedPositives: Array<{
    membershipId: string;
    replyId: string;
    occurredAt: Date;
    recordedAt: Date;
  }>;
}> {
  const [size] = await tx<{ count: number; bytes: string | null }[]>`
    select count(*)::int as count,sum(octet_length(r.issued_snapshot::text))::text as bytes
    from growth.campaign_memberships m join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id
    where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff}`;
  if (
    !size ||
    size.count > 5000 ||
    BigInt(size.bytes ?? "0") > BigInt(33554432)
  )
    throw new Error("report_cohort_limit");
  const rows = await tx<ConfirmationRow[]>`
    select m.id as "membershipId",m.campaign_id as "campaignId",m.business_id as "businessId",m.policy_version as "policyVersion",m.sequence_id as "sequenceId",
      m.confirmed_snapshot as "confirmedSnapshot",c.policy,r.id as "reservationId",r.account_id as "accountId",
      r.connection_id as "connectionId",r.grant_epoch as "grantEpoch",r.rfc_message_id as rfc,
      r.provider_message_id as "providerId",r.provider_thread_id as "threadId",r.issued_snapshot_hash as hash,
      r.issued_snapshot as snapshot,r.confirmation_receipt as receipt,r.direct_submission_evidence as "directEvidence",
      r.confirmation_observed_at as "observedAt",r.submitted_at as "submittedAt",em.outreach_guarded_claim as "guardedClaim"
    from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
    join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id
    join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=r.sequence_id
    where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff}
    order by r.confirmation_observed_at,m.id limit 5001`;
  if (rows.length > 5000) throw new Error("report_cohort_limit");
  const members: CampaignReportInput["members"] = [];
  for (const row of rows) {
    const member = projectConfirmation(row);
    if (member) members.push(member);
  }
  const replies = await tx<
    {
      membershipId: string;
      id: string;
      kind: CampaignReportInput["members"][number]["replies"][number]["kind"];
      occurredAt: Date;
      recordedAt: Date;
    }[]
  >`
    select e.membership_id as "membershipId",em.id,e.review_reply_kind as kind,em.received_at as "occurredAt",e.occurred_at as "recordedAt"
    from growth.outreach_events e join growth.email_messages em on em.id=e.review_inbound_message_id
    where e.campaign_id=${campaignId} and e.event_type='record_reply' and em.received_at<=${cutoff}
    order by e.id limit 20001`;
  if (replies.length > 20000) throw new Error("report_reply_limit");
  const byId = new Map(members.map((member) => [member.membershipId, member]));
  for (const reply of replies)
    byId.get(reply.membershipId)?.replies.push({ ...reply, reviewed: true });
  // These intervals show what was visible when this transaction read them. Their
  // transaction-start timestamps cannot establish that they existed at cutoff.
  const coverage = await tx<
    Array<ReplyCoverageInterval & { id: string; connectionId: string }>
  >`
    select id,connection_id as "connectionId",google_subject as "googleSubject",grant_epoch as "grantEpoch",
      state,observed_from as "observedFrom",observed_until as "observedUntil"
    from growth.gmail_reply_coverage where connection_id in (
      select distinct r.connection_id from growth.campaign_memberships m
      join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id
      where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff}
    ) and (observed_from is null or observed_from<=${cutoff}) order by id limit 20001`;
  if (coverage.length > 20000) throw new Error("report_coverage_limit");
  const coverageByAccount = new Map<string, ReplyCoverageInterval[]>();
  for (const interval of coverage) {
    const key = JSON.stringify([interval.connectionId, interval.googleSubject]);
    const group = coverageByAccount.get(key) ?? [];
    group.push(interval);
    coverageByAccount.set(key, group);
  }
  let observedCompleteAtRead = 0;
  for (const row of rows) {
    const member = byId.get(row.membershipId);
    const issued = issuedSchema.safeParse(row.snapshot);
    const from = member?.confirmation.possibleInvocationFrom;
    if (!member || !issued.success || !from) continue;
    const end = new TZDateMini(
      member.confirmation.observedAt.getTime(),
      "Europe/London",
    );
    end.setDate(end.getDate() + 14);
    if (end > cutoff) continue;
    if (
      hasCompleteReplyCoverage(
        coverage.filter(
          (interval) => interval.connectionId === row.connectionId,
        ),
        issued.data.googleSubject,
        from,
        new Date(end.getTime()),
      )
    )
      observedCompleteAtRead++;
  }
  return {
    members,
    unsupported: rows.length - members.length,
    observedCompleteAtRead,
    sourceReceiptIds: rows.map((row) => row.reservationId),
    sourceReplyIds: replies.map((reply) => reply.id),
    sourceCoverageIds: coverage.map((interval) => interval.id),
    lateReviewedPositives: replies
      .filter(
        (reply) =>
          reply.kind === "positive" &&
          reply.recordedAt > cutoff &&
          byId.has(reply.membershipId),
      )
      .map((reply) => ({
        membershipId: reply.membershipId,
        replyId: reply.id,
        occurredAt: reply.occurredAt,
        recordedAt: reply.recordedAt,
      })),
  };
}
