import { createHash } from "node:crypto";
import { z } from "zod";
import { TZDateMini } from "@date-fns/tz";
import {
  hasRequiredGmailScopes,
  sameAccountScopes,
} from "../integrations/google-oauth";
import { parseGmailRecipients } from "../integrations/gmail/recipients";
import {
  proveReferences,
  type ProvenReferenceRow,
} from "../sequences/gmail-reference-attribution";
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
const monitorSchema = z.object({
  connectionId: z.uuid(),
  googleSubject: z.string().min(1),
  grantEpoch: z.number().int().positive(),
  address: z.email(),
  grantedScopes: z.array(z.string()).min(1),
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
  monitoredMailbox: monitorSchema.optional(),
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
  currentMonitor: z
    .object({
      connectionId: z.string().nullable(),
      googleSubject: z.string().nullable(),
      grantEpoch: z.number().nullable(),
      address: z.string().nullable(),
      grantedScopes: z.array(z.string()).nullable(),
      status: z.string().nullable(),
    })
    .optional(),
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
  attribution: z.unknown().optional(),
  attributionReservationId: z.string().nullable().optional(),
  fromHeader: z.string().nullable().optional(),
});
const exactAttributionSchema = z.strictObject({
  basis: z.literal("gmail_exact_reference_v1"),
  outboundProvider: z.literal("resend"),
  reservationId: z.uuid(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  googleSubject: z.string(),
  grantEpoch: z.number().int().positive(),
  recipient: z.email(),
});
const referenceRow = z.object({
  id: z.string(),
  channel: z.string(),
  sequenceId: z.string(),
  membershipId: z.string(),
  status: z.string(),
  prospectId: z.string(),
  contactId: z.string(),
  contactEmail: z.string(),
  rfc: z.string(),
  accountId: z.string(),
  connectionId: z.string(),
  grantEpoch: z.number().nullable(),
  generation: z.string().nullable(),
  key: z.string(),
  hash: z.string(),
  providerId: z.string(),
  threadId: z.string().nullable(),
  snapshot: z.unknown(),
  evidence: z.unknown(),
  receipt: z.unknown(),
  deliveryMatches: z.boolean(),
  membershipMatches: z.boolean(),
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
  kind: z.enum([
    "member",
    "reply",
    "coverage",
    "outcome",
    "reference",
    "reference_overflow",
  ]),
  payload: z.unknown(),
  snapshot: z.string(),
  readAt: date,
});

export function currentMonitorMatches(
  row: ConfirmationRow,
  monitor: z.infer<typeof monitorSchema>,
): boolean {
  const current = row.currentMonitor;
  return (
    !!current &&
    current.status === "connected" &&
    current.connectionId === monitor.connectionId &&
    current.googleSubject === monitor.googleSubject &&
    current.grantEpoch === monitor.grantEpoch &&
    current.address === monitor.address &&
    !!current.grantedScopes &&
    hasRequiredGmailScopes(current.grantedScopes) &&
    sameAccountScopes(current.grantedScopes, monitor.grantedScopes)
  );
}
export function isProvenResendReply(
  reply: z.infer<typeof replyRow>,
  row: ConfirmationRow,
  reference: ProvenReferenceRow | undefined,
): boolean {
  const issued = resendIssued.safeParse(row.snapshot),
    attribution = exactAttributionSchema.safeParse(reply.attribution);
  if (
    !issued.success ||
    !issued.data.monitoredMailbox ||
    !attribution.success ||
    !reference ||
    !reply.fromHeader ||
    reply.attributionReservationId !== attribution.data.reservationId ||
    reference.id !== attribution.data.reservationId ||
    reference.membershipId !== row.membershipId ||
    reference.sequenceId !== row.sequenceId
  )
    return false;
  const monitor = issued.data.monitoredMailbox;
  const from = parseGmailRecipients({
    to: reply.fromHeader,
    cc: null,
    bcc: null,
  });
  if (
    !from ||
    from.to.length !== 1 ||
    from.to[0] !== attribution.data.recipient ||
    issued.data.replyTo !== monitor.address ||
    !hasRequiredGmailScopes(monitor.grantedScopes)
  )
    return false;
  const binding = {
    connectionId: monitor.connectionId,
    googleSubject: monitor.googleSubject,
    grantEpoch: monitor.grantEpoch,
    grantedScopes: monitor.grantedScopes,
  };
  const proven = proveReferences(
    [reference],
    attribution.data.recipient,
    binding,
    monitor.address,
  );
  return (
    proven.length === 1 &&
    JSON.stringify(proven[0].attribution) === JSON.stringify(attribution.data)
  );
}

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
      select m.id as "membershipId",m.campaign_id as "campaignId",m.business_id as "businessId",m.policy_version as "policyVersion",m.sequence_id as "sequenceId",m.confirmed_snapshot as "confirmedSnapshot",c.policy,r.id as "reservationId",r.account_id as "accountId",r.connection_id as "connectionId",r.outreach_provider::text as provider,r.grant_epoch as "grantEpoch",r.rfc_message_id as rfc,r.provider_message_id as "providerId",r.provider_thread_id as "threadId",r.issued_snapshot_hash as hash,r.issued_snapshot as snapshot,r.confirmation_receipt as receipt,r.direct_submission_evidence as "directEvidence",r.confirmation_observed_at as "observedAt",coalesce(r.confirmation_observed_at < (select confirmation_observed_at from growth.outreach_reservations where id=${anchorReservationId ?? null}::uuid),false) as "earlierThanAnchor",r.submitted_at as "submittedAt",em.outreach_guarded_claim as "guardedClaim",em.controlled_preparation as "controlledPreparation",r.resend_send_generation as generation,r.idempotency_key as "idempotencyKey",em.id as "messageId",em.rfc_message_id as "messageRfc",em.provider_message_id as "messageProviderId",de.provider_event_id as "eventId",de.outreach_body_sha256 as "eventHash",de.outreach_webhook_generation as "eventGeneration",de.outreach_rfc_message_id as "eventRfc",de.recipient_normalised_email as "eventRecipient",de.outreach_connection_id as "eventConnection",de.email_message_id as "eventMessageId",de.sanitised_payload->>'provider_message_id' as "eventProviderId",case when r.outreach_provider='resend' then (r.confirmation_receipt->>'observedAt')::timestamptz=r.confirmation_observed_at else null end as "receiptMatchesObserved",case when r.outreach_provider='resend' then de.occurred_at=(r.confirmation_receipt->>'providerEventCreatedAt')::timestamptz else null end as "eventTimeMatches",jsonb_build_object('connectionId',gm.id,'googleSubject',gm.google_subject,'grantEpoch',gm.version,'address',gm.subject_email,'grantedScopes',gm.granted_scopes,'status',gm.status) as "currentMonitor"
      from growth.campaign_memberships m join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=r.sequence_id left join growth.resend_delivery_events de on de.outreach_reservation_id=r.id and de.event_type='email.delivered' left join growth.integration_connections gm on gm.id=case when (r.issued_snapshot->'monitoredMailbox'->>'connectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.issued_snapshot->'monitoredMailbox'->>'connectionId')::uuid end and gm.provider='gmail'
      where m.campaign_id=${campaignId} and r.confirmation_observed_at<=${cutoff} order by r.confirmation_observed_at,m.id limit 5001
    ), replies as materialized (
      select m."membershipId",em.id,em.channel,em.received_at as "occurredAt",e.membership_id as "reviewMemberId",e.review_reply_kind as "reviewKind",e.occurred_at as "recordedAt",coalesce(e.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")} and e.request_id is not null and e.result_id=em.id and e.campaign_id=${campaignId} and e.policy_version=m."policyVersion",false) as "reviewProven",coalesce(ev.count,0)>0 as "sourceProven",case when ev.count=1 then ev.attribution end as attribution,case when ev.count=1 then ev.reservation_id end as "attributionReservationId",case when ev.count=1 then ev.from_header end as "fromHeader"
      from members m join growth.email_messages em on em.sequence_enrollment_id=m."sequenceId" and em.direction='inbound' and em.status='received' left join growth.outreach_events e on e.review_inbound_message_id=em.id and e.event_type='record_reply'
      left join lateral (select count(*)::int as count,(array_agg(v.outreach_reply_attribution order by v.id))[1] as attribution,(array_agg(v.outreach_reply_reservation_id order by v.id))[1] as reservation_id,(array_agg(v.sanitised_payload->>'from' order by v.id))[1] as from_header from growth.email_events v where v.email_message_id=em.id and v.provider='gmail' and v.provider_event_id=em.provider_message_id and v.event_type in ('reply','auto_response')) ev on true
      where em.received_at is null or em.received_at<=${cutoff} order by em.id,m."membershipId" limit 20001
    ), reference_rows as materialized (
      select r.id,em.channel,r.membership_id as "membershipId",se.id as "sequenceId",se.status,se.prospect_id as "prospectId",se.contact_id as "contactId",ct.normalised_email as "contactEmail",em.rfc_message_id as rfc,r.account_id as "accountId",r.connection_id as "connectionId",r.grant_epoch as "grantEpoch",r.resend_send_generation as generation,r.idempotency_key as key,r.issued_snapshot_hash as hash,r.provider_message_id as "providerId",r.provider_thread_id as "threadId",(r.issued_snapshot - array['rawBody','raw']) as snapshot,r.direct_submission_evidence as evidence,r.confirmation_receipt as receipt,
        exists(select 1 from growth.campaign_memberships m where m.id=r.membership_id and m.sequence_id=se.id and m.prospect_id=se.prospect_id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version) as "membershipMatches",
        exists(select 1 from growth.resend_delivery_events d where d.outreach_reservation_id=r.id and d.outreach_connection_id=r.connection_id and d.event_type='email.delivered' and d.email_message_id=em.id and d.recipient_normalised_email=ct.normalised_email and d.provider_event_id=r.confirmation_receipt->>'providerEventId' and d.outreach_rfc_message_id=em.rfc_message_id and d.outreach_body_sha256=r.confirmation_receipt->>'bodySha256' and d.outreach_webhook_generation::text=r.confirmation_receipt->>'webhookGeneration') as "deliveryMatches"
      from growth.outreach_reservations r join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=r.sequence_id join growth.sequence_enrollments se on se.id=r.sequence_id and se.prospect_id=em.prospect_id and se.contact_id=em.contact_id join growth.contacts ct on ct.id=se.contact_id
      where r.id in (select "attributionReservationId" from replies where "attributionReservationId" is not null) and em.channel='resend' and em.direction='outbound' and em.provider_message_id=r.provider_message_id and r.status='accepted' and r.confirmation_observed_at is not null and r.direct_submission_evidence is not null order by r.id limit 20001
    ), reference_budget as materialized (
      select count(*) as n,coalesce(sum(octet_length(snapshot::text)),0) as bytes from reference_rows
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
      select g.id,g.connection_id as "connectionId",g.google_subject as "googleSubject",g.grant_epoch as "grantEpoch",g.state,g.observed_from as "observedFrom",g.observed_until as "observedUntil" from growth.gmail_reply_coverage g where g.connection_id in (select distinct case when provider='resend' and (snapshot->'monitoredMailbox'->>'connectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (snapshot->'monitoredMailbox'->>'connectionId')::uuid when coalesce(provider,'gmail')='gmail' then "connectionId" end from members) and (g.observed_from is null or g.observed_from<=${cutoff}) order by g.id limit 20001
    ), snapshot as materialized (select pg_current_snapshot()::text as snapshot,statement_timestamp() as "readAt")
    select 'member' as kind,to_jsonb(members) as payload,snapshot.snapshot,snapshot."readAt" from members cross join snapshot
    union all select 'reply',to_jsonb(replies),snapshot.snapshot,snapshot."readAt" from replies cross join snapshot
    union all select 'coverage',to_jsonb(coverage),snapshot.snapshot,snapshot."readAt" from coverage cross join snapshot
    union all select 'outcome',to_jsonb(outcomes),snapshot.snapshot,snapshot."readAt" from outcomes cross join snapshot
    union all select 'reference',to_jsonb(reference_rows),snapshot.snapshot,snapshot."readAt" from reference_rows cross join reference_budget cross join snapshot where reference_budget.n<=20000 and reference_budget.bytes<=33554432
    union all select 'reference_overflow','{}'::jsonb,snapshot.snapshot,snapshot."readAt" from reference_budget cross join snapshot where reference_budget.n>20000 or reference_budget.bytes>33554432`;
  const rows = raw.map((row) => resultRow.parse(row));
  if (rows.some((row) => row.kind === "reference_overflow"))
    throw new Error("report_evidence_limit");
  const membersRaw = rows
    .filter((row) => row.kind === "member")
    .map((row) => confirmationRowSchema.parse(row.payload));
  const replies = rows
    .filter((row) => row.kind === "reply")
    .map((row) => replyRow.parse(row.payload));
  const referenceResults = rows
    .filter((row) => row.kind === "reference")
    .map((row) => referenceRow.safeParse(row.payload));
  const references = referenceResults.flatMap((result) =>
    result.success ? [result.data] : [],
  );
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
    outcomes.length > 20000 ||
    referenceResults.length > 20000
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
  const referencesById = new Map(
    references.map((reference) => [reference.id, reference]),
  );
  const exactByReply = new Map<string, boolean>();
  const inboundByMember = new Map<string, Array<z.infer<typeof replyRow>>>();
  for (const reply of replies) {
    const group = inboundByMember.get(reply.membershipId) ?? [];
    group.push(reply);
    inboundByMember.set(reply.membershipId, group);
    const member = byId.get(reply.membershipId);
    const reference = reply.attributionReservationId
      ? referencesById.get(reply.attributionReservationId)
      : undefined;
    const source = sourceRows.get(reply.membershipId);
    const exact =
      member?.confirmation.basis === "resend_fss_delivery_observed" && source
        ? isProvenResendReply(reply, source, reference)
        : false;
    exactByReply.set(`${reply.membershipId}:${reply.id}`, exact);
    if (
      member &&
      (member.confirmation.basis !== "resend_fss_delivery_observed" || exact) &&
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
    const row = sourceRows.get(member.membershipId);
    const from = member.confirmation.possibleInvocationFrom;
    if (!row || !from) continue;
    const gmail = gmailIssued.safeParse(row.snapshot);
    const resend = resendIssued.safeParse(row.snapshot);
    const monitor = resend.success ? resend.data.monitoredMailbox : undefined;
    const isResend =
      member.confirmation.basis === "resend_fss_delivery_observed";
    if (
      isResend &&
      (!monitor ||
        !resend.success ||
        resend.data.replyTo !== monitor.address ||
        !currentMonitorMatches(row, monitor))
    )
      continue;
    if (!isResend && !gmail.success) continue;
    const connectionId = isResend ? monitor?.connectionId : row.connectionId;
    const subject = isResend
      ? monitor?.googleSubject
      : gmail.success
        ? gmail.data.googleSubject
        : undefined;
    if (!connectionId || !subject) continue;
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
          (isResend &&
            !exactByReply.get(`${member.membershipId}:${reply.id}`)) ||
          !reply.sourceProven ||
          !reply.reviewProven ||
          reply.reviewMemberId !== member.membershipId ||
          !reply.reviewKind ||
          reply.reviewKind === "unknown" ||
          !reply.recordedAt),
    );
    if (
      !unclassified &&
      covered(connectionId, subject, from, new Date(end.getTime())) &&
      (!isResend ||
        (!!monitor &&
          covered(
            connectionId,
            subject,
            from,
            new Date(end.getTime()),
            monitor.grantEpoch,
          )))
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
          (byId.get(reply.membershipId)?.confirmation.basis !==
            "resend_fss_delivery_observed" ||
            exactByReply.get(`${reply.membershipId}:${reply.id}`)) &&
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
