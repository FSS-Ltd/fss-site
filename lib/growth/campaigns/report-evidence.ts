import { createHash } from "node:crypto";
import { z } from "zod";
import { TZDateMini } from "@date-fns/tz";
import type { GrowthTransaction } from "../db/types";
import { campaignSchema } from "./gmail-confirmation-campaign";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { matchesDirectSubmissionEvidence } from "./direct-submission-evidence";
import { matchesResendSubmissionEvidence } from "./resend-reservation-evidence";
import {
  controlledCopyFamilyFingerprint,
  CONTROLLED_FIRST_COPY_FAMILY_VERSION,
} from "./controlled-copy";
import { assignCampaignVariant } from "./variants";
import { indexReportCoverage, type CoverageRecord } from "./report-coverage";
import { campaignPolicySchema, type CampaignReportInput } from "./schemas";

const gmailReceipt = z.object({
  basis: z.literal("gmail_fss_sent_observed"),
  providerMessageId: z.string().min(1),
  providerThreadId: z.string().min(1),
  rfcMessageId: z.string().min(1),
  googleSubject: z.string().min(1),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedUntil: z.iso.datetime(),
  possibleInvocationFrom: z.iso.datetime().nullable().optional(),
});
const gmailIssued = z.object({
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
const resendIssued = z.object({
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
const resendBody = z.object({
  from: z.email(),
  to: z.tuple([z.email()]),
  reply_to: z.email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().min(1),
});
const resendReceipt = z.object({
  basis: z.literal("resend_fss_delivery_observed"),
  providerMessageId: z.string().min(1),
  providerEventId: z.string().min(1),
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  rfcMessageId: z.string().min(1),
  connectionId: z.uuid(),
  webhookGeneration: z.uuid(),
  sendGeneration: z.uuid(),
  observedAt: z.iso.datetime({ offset: true }),
  possibleInvocationFrom: z.iso.datetime({ offset: true }),
});
const date = z.coerce.date();
const confirmationRowSchema = z.object({
  membershipId: z.string(),
  campaignId: z.string(),
  businessId: z.string(),
  policyVersion: z.number().int(),
  sequenceId: z.string(),
  confirmedSnapshot: z.unknown(),
  policy: z.unknown(),
  reservationId: z.string(),
  accountId: z.string(),
  connectionId: z.string(),
  provider: z.string().nullable().optional(),
  grantEpoch: z.number().nullable(),
  rfc: z.string().nullable(),
  providerId: z.string().nullable(),
  threadId: z.string().nullable(),
  hash: z.string(),
  snapshot: z.unknown(),
  receipt: z.unknown(),
  directEvidence: z.unknown(),
  observedAt: date,
  submittedAt: date.nullable(),
  guardedClaim: z.boolean(),
  controlledPreparation: z.unknown().optional(),
  generation: z.string().nullable().optional(),
  idempotencyKey: z.string().optional(),
  messageId: z.string().optional(),
  messageRfc: z.string().nullable().optional(),
  messageProviderId: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  eventHash: z.string().nullable().optional(),
  eventGeneration: z.string().nullable().optional(),
  eventRfc: z.string().nullable().optional(),
  eventRecipient: z.string().nullable().optional(),
  eventConnection: z.string().nullable().optional(),
  eventMessageId: z.string().nullable().optional(),
  eventProviderId: z.string().nullable().optional(),
  receiptMatchesObserved: z.boolean().nullable().optional(),
  eventTimeMatches: z.boolean().nullable().optional(),
  earlierThanAnchor: z.boolean().optional(),
});
type ConfirmationRow = z.infer<typeof confirmationRowSchema>;
type ReportMember = CampaignReportInput["members"][number];

function commonMember(
  row: ConfirmationRow,
  c: z.infer<typeof campaignSchema>,
  provider: "gmail" | "resend",
): Omit<ReportMember, "confirmation"> | null {
  const parsedPolicy = campaignPolicySchema.safeParse(row.policy);
  const frozen = campaignSchema.safeParse(row.confirmedSnapshot);
  if (!parsedPolicy.success || !frozen.success) return null;
  const policy = parsedPolicy.data,
    variant = policy.variants.find(
      (v) => v.id === c.variantId && v.version === c.variantVersion,
    );
  if (
    !variant ||
    c.membershipId !== row.membershipId ||
    c.campaignId !== row.campaignId ||
    c.businessId !== row.businessId ||
    c.policyVersion !== row.policyVersion ||
    policy.version !== c.policyVersion ||
    policy.offer !== c.offer ||
    policy.provider !== provider ||
    JSON.stringify(policy.commercialTerms ?? null) !==
      JSON.stringify(c.commercialTerms ?? null) ||
    JSON.stringify(c) !== JSON.stringify(frozen.data)
  )
    return null;
  let comparisonFingerprint: string | null = null;
  const preparation = z
    .object({
      version: z.literal(1),
      variantId: z.string(),
      variantVersion: z.number().int(),
      observationProofId: z.uuid(),
      permissionId: z.uuid(),
      copySha256: z.string(),
      copyFamilyVersion: z.number().int(),
      copyFamilySha256: z.string(),
    })
    .safeParse(row.controlledPreparation);
  if (
    preparation.success &&
    preparation.data.variantId === c.variantId &&
    preparation.data.variantVersion === c.variantVersion &&
    preparation.data.observationProofId === c.sourceProof.observationProofId &&
    preparation.data.permissionId === c.permissionId &&
    preparation.data.copySha256 === c.copySha256 &&
    preparation.data.copyFamilyVersion === c.copyFamilyVersion &&
    preparation.data.copyFamilySha256 === c.copyFamilySha256 &&
    c.copyFamilyVersion === CONTROLLED_FIRST_COPY_FAMILY_VERSION &&
    c.copyFamilySha256 &&
    policy.jurisdiction &&
    policy.cadenceFamily === c.cadenceFamily &&
    c.market === policy.jurisdiction &&
    policy.variants.length === 2 &&
    policy.variants[0].id !== policy.variants[1].id &&
    policy.variants[0].version === policy.variants[1].version &&
    policy.variants[0].cta !== policy.variants[1].cta &&
    assignCampaignVariant({
      businessId: c.businessId,
      market: c.market,
      seed: `${c.campaignId}:${c.policyVersion}`,
      variantIds: [policy.variants[0].id, policy.variants[1].id],
    }) === c.variantId
  ) {
    const expected = controlledCopyFamilyFingerprint({
      familyVersion: c.copyFamilyVersion,
      campaignId: c.campaignId,
      policyVersion: c.policyVersion,
      market: c.market,
      jurisdiction: policy.jurisdiction,
      offer: c.offer,
      commercialTerms: c.commercialTerms,
      permissionRequirement: policy.permissionRequirement,
      cadenceFamily: policy.cadenceFamily,
      provider,
    });
    if (expected === c.copyFamilySha256)
      comparisonFingerprint = `${c.copyFamilyVersion}:${c.copyFamilySha256}`;
  }
  const terms = c.commercialTerms
    ? createHash("sha256")
        .update(JSON.stringify(c.commercialTerms))
        .digest("hex")
    : comparisonFingerprint && ["review", "website_preview"].includes(c.offer)
      ? createHash("sha256")
          .update(`legacy:${c.offer}:family:${c.copyFamilyVersion}`)
          .digest("hex")
      : null;
  return {
    membershipId: row.membershipId,
    businessId: row.businessId,
    market: c.market,
    offer: c.offer,
    policyVersion: c.policyVersion,
    variantId: c.variantId,
    variantVersion: c.variantVersion,
    cta: variant.cta,
    comparisonFingerprint,
    commercialTermsFingerprint: terms,
    replyCoverage: "unknown",
    meetingObservation: "unknown",
    paymentObservation: "unknown",
    replies: [],
    outcomes: [],
  };
}

export function projectConfirmation(row: ConfirmationRow): ReportMember | null {
  const issued = gmailIssued.safeParse(row.snapshot),
    receipt = gmailReceipt.safeParse(row.receipt);
  if (!issued.success || !receipt.success) return null;
  const s = issued.data,
    r = receipt.data,
    common = commonMember(row, s.campaign, "gmail"),
    raw = Buffer.from(s.raw, "base64url");
  if (
    !common ||
    s.membershipId !== row.membershipId ||
    s.sequenceId !== row.sequenceId ||
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
    ...common,
    confirmation: {
      basis: r.basis,
      observedAt: row.observedAt,
      possibleInvocationFrom: r.possibleInvocationFrom
        ? new Date(r.possibleInvocationFrom)
        : null,
    },
  };
}

export function projectResendConfirmation(
  row: ConfirmationRow,
): ReportMember | null {
  const issued = resendIssued.safeParse(row.snapshot),
    receipt = resendReceipt.safeParse(row.receipt);
  if (!issued.success || !receipt.success) return null;
  const s = issued.data,
    r = receipt.data,
    common = commonMember(row, s.campaign, "resend");
  let body: z.infer<typeof resendBody>;
  try {
    const parsed = resendBody.safeParse(JSON.parse(s.rawBody));
    if (!parsed.success) return null;
    body = parsed.data;
  } catch {
    return null;
  }
  if (
    !common ||
    s.membershipId !== row.membershipId ||
    s.sequenceId !== row.sequenceId ||
    s.connectionId !== row.connectionId ||
    s.accountId !== row.accountId ||
    s.sendGeneration !== row.generation ||
    s.idempotencyKey !== row.idempotencyKey ||
    s.messageId !== row.messageId ||
    s.bodySha256 !== row.hash ||
    body.from !== s.from ||
    body.reply_to !== s.replyTo ||
    body.to[0] !== s.recipient ||
    createHash("sha256").update(s.rawBody, "utf8").digest("hex") !== row.hash ||
    r.connectionId !== row.connectionId ||
    r.sendGeneration !== row.generation ||
    r.providerMessageId !== row.providerId ||
    r.providerMessageId !== row.messageProviderId ||
    r.rfcMessageId !== row.messageRfc ||
    r.providerEventId !== row.eventId ||
    r.bodySha256 !== row.eventHash ||
    r.webhookGeneration !== row.eventGeneration ||
    r.rfcMessageId !== row.eventRfc ||
    s.recipient !== row.eventRecipient ||
    row.connectionId !== row.eventConnection ||
    row.messageId !== row.eventMessageId ||
    r.providerMessageId !== row.eventProviderId ||
    !row.receiptMatchesObserved ||
    !row.eventTimeMatches ||
    !row.submittedAt ||
    new Date(r.possibleInvocationFrom).getTime() !==
      row.submittedAt.getTime() ||
    !matchesResendSubmissionEvidence(row.directEvidence, {
      version: 1,
      kind: "resend_api_send_email_v1",
      reservationId: row.reservationId,
      accountId: row.accountId,
      connectionId: row.connectionId,
      sendGeneration: row.generation,
      idempotencyKey: row.idempotencyKey,
      bodySha256: row.hash,
      providerMessageId: row.providerId,
    })
  )
    return null;
  return {
    ...common,
    confirmation: {
      basis: r.basis,
      observedAt: row.observedAt,
      possibleInvocationFrom: new Date(r.possibleInvocationFrom),
    },
  };
}

const replyRow = z.object({
  membershipId: z.string(),
  id: z.string(),
  channel: z.string(),
  occurredAt: date.nullable(),
  reviewMemberId: z.string().nullable(),
  reviewKind: z
    .enum([
      "positive",
      "negative",
      "bot",
      "out_of_office",
      "opt_out",
      "unknown",
    ])
    .nullable(),
  recordedAt: date.nullable(),
  sourceProven: z.boolean(),
  reviewProven: z.boolean(),
});
const outcomeRow = z.object({
  membershipId: z.string(),
  id: z.string(),
  kind: z.enum(["meeting", "proposal"]),
  sourceId: z.string(),
  occurredAt: date,
  recordedAt: date,
  reviewProven: z.boolean(),
});
const coverageRow = z.object({
  id: z.string(),
  connectionId: z.string(),
  googleSubject: z.string(),
  grantEpoch: z.number().int(),
  state: z.enum(["complete", "gap"]),
  observedFrom: date.nullable(),
  observedUntil: date,
});
const resultRow = z.object({
  kind: z.enum(["member", "reply", "coverage", "outcome"]),
  payload: z.unknown(),
  snapshot: z.string(),
  readAt: date,
});

export async function loadReportEvidence(
  tx: GrowthTransaction,
  campaignId: string,
  cutoff: Date,
  anchorReservationId?: string,
) {
  // Receipt rows are immutable and routing-fenced. This guard caps the raw body
  // transferred by the single statement snapshot below.
  const [size] = await tx<
    { count: number; bytes: string | null }[]
  >`select count(*)::int as count,sum(octet_length(r.issued_snapshot::text))::text as bytes from growth.campaign_memberships m join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff}`;
  if (
    !size ||
    size.count > 5000 ||
    BigInt(size.bytes ?? "0") > BigInt(33554432)
  )
    throw new Error("report_cohort_limit");
  const raw = await tx<
    { kind: string; payload: unknown; snapshot: string; readAt: Date }[]
  >`
    with members as materialized (
      select m.id as "membershipId",m.campaign_id as "campaignId",m.business_id as "businessId",m.policy_version as "policyVersion",m.sequence_id as "sequenceId",m.confirmed_snapshot as "confirmedSnapshot",c.policy,r.id as "reservationId",r.account_id as "accountId",r.connection_id as "connectionId",r.outreach_provider::text as provider,r.grant_epoch as "grantEpoch",r.rfc_message_id as rfc,r.provider_message_id as "providerId",r.provider_thread_id as "threadId",r.issued_snapshot_hash as hash,r.issued_snapshot as snapshot,r.confirmation_receipt as receipt,r.direct_submission_evidence as "directEvidence",r.confirmation_observed_at as "observedAt",coalesce(r.confirmation_observed_at < (select confirmation_observed_at from growth.outreach_reservations where id=${anchorReservationId ?? null}::uuid),false) as "earlierThanAnchor",r.submitted_at as "submittedAt",em.outreach_guarded_claim as "guardedClaim",em.controlled_preparation as "controlledPreparation",r.resend_send_generation as generation,r.idempotency_key as "idempotencyKey",em.id as "messageId",em.rfc_message_id as "messageRfc",em.provider_message_id as "messageProviderId",de.provider_event_id as "eventId",de.outreach_body_sha256 as "eventHash",de.outreach_webhook_generation as "eventGeneration",de.outreach_rfc_message_id as "eventRfc",de.recipient_normalised_email as "eventRecipient",de.outreach_connection_id as "eventConnection",de.email_message_id as "eventMessageId",de.sanitised_payload->>'provider_message_id' as "eventProviderId",case when r.outreach_provider='resend' then (r.confirmation_receipt->>'observedAt')::timestamptz=r.confirmation_observed_at else null end as "receiptMatchesObserved",case when r.outreach_provider='resend' then de.occurred_at=(r.confirmation_receipt->>'providerEventCreatedAt')::timestamptz else null end as "eventTimeMatches"
      from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=r.sequence_id left join growth.resend_delivery_events de on de.outreach_reservation_id=r.id and de.event_type='email.delivered'
      where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff} order by r.confirmation_observed_at,m.id limit 5001
    ), replies as materialized (
      select m."membershipId",em.id,em.channel,em.received_at as "occurredAt",e.membership_id as "reviewMemberId",e.review_reply_kind as "reviewKind",e.occurred_at as "recordedAt",coalesce(e.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")} and e.request_id is not null and e.result_id=em.id and e.campaign_id=${campaignId} and e.policy_version=m."policyVersion",false) as "reviewProven",exists(select 1 from growth.email_events ev where ev.email_message_id=em.id and ev.provider='gmail' and ev.provider_event_id=em.provider_message_id and ev.event_type in ('reply','auto_response')) as "sourceProven"
      from members m join growth.email_messages em on em.sequence_enrollment_id=m."sequenceId" and em.direction='inbound' and em.status='received' left join growth.outreach_events e on e.review_inbound_message_id=em.id and e.event_type='record_reply'
      where em.received_at is null or em.received_at<=${cutoff} order by em.id,m."membershipId" limit 20001
    ), outcomes as materialized (
      select m."membershipId",e.id,e.review_outcome_kind as kind,coalesce(e.review_meeting_activity_id,e.review_proposal_event_id) as "sourceId",e.review_outcome_at as "occurredAt",e.occurred_at as "recordedAt",
        coalesce(e.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")} and e.request_id is not null and e.request_hash ~ '^[a-f0-9]{64}$' and e.result_id=coalesce(e.review_meeting_activity_id,e.review_proposal_event_id) and e.campaign_id=${campaignId} and e.policy_version=m."policyVersion" and
          ((e.review_outcome_kind='meeting' and a.activity_type='meeting' and a.prospect_id=cm.prospect_id)
          or (e.review_outcome_kind='proposal' and se.dimension='commercial' and se.to_state='proposal' and de.prospect_id=cm.prospect_id and se.occurred_at=e.review_outcome_at)),false) as "reviewProven"
      from members m join growth.campaign_memberships cm on cm.id=m."membershipId"
      join growth.outreach_events e on e.membership_id=m."membershipId" and e.event_type='record_outcome'
      left join growth.crm_activities a on a.id=e.review_meeting_activity_id
      left join growth.commercial_stage_events se on se.id=e.review_proposal_event_id
      left join growth.delivery_engagements de on de.id=se.engagement_id
      where e.review_outcome_at<=${cutoff} order by e.id limit 20001
    ), coverage as materialized (
      select g.id,g.connection_id as "connectionId",g.google_subject as "googleSubject",g.grant_epoch as "grantEpoch",g.state,g.observed_from as "observedFrom",g.observed_until as "observedUntil" from growth.gmail_reply_coverage g where g.connection_id in (select distinct "connectionId" from members where coalesce(provider,'gmail')='gmail') and (g.observed_from is null or g.observed_from<=${cutoff}) order by g.id limit 20001
    ), snapshot as materialized (select pg_current_snapshot()::text as snapshot,statement_timestamp() as "readAt")
    select 'member' as kind,to_jsonb(members) as payload,snapshot.snapshot,snapshot."readAt" from members cross join snapshot
    union all select 'reply',to_jsonb(replies),snapshot.snapshot,snapshot."readAt" from replies cross join snapshot
    union all select 'coverage',to_jsonb(coverage),snapshot.snapshot,snapshot."readAt" from coverage cross join snapshot
    union all select 'outcome',to_jsonb(outcomes),snapshot.snapshot,snapshot."readAt" from outcomes cross join snapshot`;
  const rows = raw.map((row) => resultRow.parse(row));
  const membersRaw = rows
    .filter((row) => row.kind === "member")
    .map((row) => confirmationRowSchema.parse(row.payload));
  const replies = rows
    .filter((row) => row.kind === "reply")
    .map((row) => replyRow.parse(row.payload));
  const outcomes = rows
    .filter((row) => row.kind === "outcome")
    .map((row) => outcomeRow.parse(row.payload));
  const coverage = rows
    .filter((row) => row.kind === "coverage")
    .map((row) => coverageRow.parse(row.payload));
  if (
    membersRaw.length > 5000 ||
    replies.length > 20000 ||
    coverage.length > 20000 ||
    outcomes.length > 20000
  )
    throw new Error("report_evidence_limit");
  const members: ReportMember[] = [];
  const sourceRows = new Map<string, ConfirmationRow>();
  for (const row of membersRaw) {
    const member =
      row.provider === "resend"
        ? projectResendConfirmation(row)
        : projectConfirmation(row);
    if (member) {
      members.push(member);
      sourceRows.set(member.membershipId, row);
    }
  }
  const byId = new Map(members.map((member) => [member.membershipId, member]));
  for (const outcome of outcomes) {
    const member = byId.get(outcome.membershipId);
    if (member && outcome.reviewProven)
      member.outcomes.push({
        membershipId: outcome.membershipId,
        outcomeId: outcome.id,
        kind: outcome.kind,
        evidenceId: outcome.sourceId,
        occurredAt: outcome.occurredAt,
        recordedAt: outcome.recordedAt,
        reviewed: true,
        netClearedPence: null,
      });
  }
  const inboundByMember = new Map<string, Array<z.infer<typeof replyRow>>>();
  for (const reply of replies) {
    const group = inboundByMember.get(reply.membershipId) ?? [];
    group.push(reply);
    inboundByMember.set(reply.membershipId, group);
    const member = byId.get(reply.membershipId);
    if (
      member &&
      reply.channel === "gmail" &&
      reply.reviewMemberId === member.membershipId &&
      reply.reviewKind &&
      reply.recordedAt &&
      reply.occurredAt &&
      reply.sourceProven &&
      reply.reviewProven
    )
      member.replies.push({
        id: reply.id,
        kind: reply.reviewKind,
        reviewed: true,
        occurredAt: reply.occurredAt,
        recordedAt: reply.recordedAt,
      });
  }
  const covered = indexReportCoverage(coverage satisfies CoverageRecord[]);
  let observedCompleteAtRead = 0;
  for (const member of members) {
    if (member.confirmation.basis !== "gmail_fss_sent_observed") continue;
    const row = sourceRows.get(member.membershipId),
      issued = gmailIssued.safeParse(row?.snapshot),
      from = member.confirmation.possibleInvocationFrom;
    if (!row || !issued.success || !from) continue;
    const end = new TZDateMini(
      member.confirmation.observedAt.getTime(),
      "Europe/London",
    );
    end.setDate(end.getDate() + 14);
    if (end > cutoff) {
      member.replyCoverage = "censored";
      continue;
    }
    const unclassified = (inboundByMember.get(member.membershipId) ?? []).some(
      (reply) =>
        (!reply.occurredAt ||
          (reply.occurredAt >= from && reply.occurredAt <= end)) &&
        (reply.channel !== "gmail" ||
          !reply.sourceProven ||
          !reply.reviewProven ||
          reply.reviewMemberId !== member.membershipId ||
          !reply.reviewKind ||
          reply.reviewKind === "unknown" ||
          !reply.recordedAt),
    );
    if (
      !unclassified &&
      covered(
        row.connectionId,
        issued.data.googleSubject,
        from,
        new Date(end.getTime()),
      )
    ) {
      member.replyCoverage = "complete";
      observedCompleteAtRead++;
    }
  }
  const snapshot = rows[0]?.snapshot,
    readAt = rows[0]?.readAt;
  if (!snapshot || !readAt) throw new Error("report_snapshot_empty");
  return {
    members,
    unsupported: membersRaw.length - members.length,
    earlierThanAnchor: membersRaw.some((row) => row.earlierThanAnchor),
    observedCompleteAtRead,
    sourceReceiptIds: membersRaw.map((row) => row.reservationId),
    sourceReplyIds: replies.map((reply) => reply.id),
    sourceCoverageIds: coverage.map((interval) => interval.id),
    snapshot,
    readAt,
    lateReviewedPositives: replies
      .filter(
        (reply) =>
          reply.reviewKind === "positive" &&
          reply.recordedAt &&
          reply.recordedAt > cutoff &&
          reply.occurredAt &&
          byId.has(reply.membershipId) &&
          reply.channel === "gmail" &&
          reply.reviewMemberId === reply.membershipId &&
          reply.sourceProven &&
          reply.reviewProven,
      )
      .map((reply) => ({
        membershipId: reply.membershipId,
        replyId: reply.id,
        occurredAt: reply.occurredAt,
        recordedAt: reply.recordedAt,
      })),
  };
}
