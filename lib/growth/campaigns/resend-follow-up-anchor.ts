import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { parseGmailReferences } from "../sequences/gmail-references";
import { campaignSchema } from "./gmail-confirmation-campaign";
import { matchesResendSubmissionEvidence } from "./resend-reservation-evidence";
import { loadResendAccountReadiness } from "./resend-account-repository";
import type { ResendRuntimeConfiguration } from "./resend-account-control";
import { campaignSchedulingAnchor } from "./time";

const monitorSchema = z.strictObject({
  connectionId: z.uuid(),
  googleSubject: z.string().min(1),
  grantEpoch: z.number().int().positive(),
  address: z.email(),
  grantedScopes: z.array(z.string()).min(1),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  kind: z.literal("resend_json"),
  rawBody: z.string().min(1),
  bodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  accountId: z.uuid(),
  connectionId: z.uuid(),
  sendGeneration: z.uuid(),
  idempotencyKey: z.string(),
  messageId: z.uuid(),
  sequenceId: z.uuid(),
  membershipId: z.uuid(),
  from: z.email(),
  replyTo: z.email(),
  recipient: z.email(),
  monitoredMailbox: monitorSchema,
  campaign: campaignSchema,
});
const receiptSchema = z.object({
  basis: z.literal("resend_fss_delivery_observed"),
  providerMessageId: z.string(),
  providerEventId: z.string(),
  bodySha256: z.string(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  webhookGeneration: z.uuid(),
  sendGeneration: z.uuid(),
  observedAt: z.iso.datetime({ offset: true }),
  possibleInvocationFrom: z.iso.datetime({ offset: true }),
});
type Row = {
  id: string;
  accountId: string;
  connectionId: string;
  generation: string;
  key: string;
  messageId: string;
  sequenceId: string;
  providerId: string;
  messageProviderId: string;
  rfc: string;
  hash: string;
  snapshot: unknown;
  evidence: unknown;
  receipt: unknown;
  submittedAt: Date;
  observedAt: Date;
  subMillisecond: boolean;
  subject: string;
  html: string;
  text: string;
  guarded: boolean;
  sameSnapshot: boolean;
  deliveryMatches: boolean;
};

async function readReceipt(
  tx: GrowthTransaction,
  membershipId: string,
  connectionId: string,
  step: 0 | 1,
): Promise<Row[]> {
  return tx<
    Row[]
  >`select r.id,r.account_id as "accountId",r.connection_id as "connectionId",r.resend_send_generation as generation,r.idempotency_key as key,r.email_message_id as "messageId",r.sequence_id as "sequenceId",r.provider_message_id as "providerId",em.provider_message_id as "messageProviderId",em.rfc_message_id as rfc,r.issued_snapshot_hash as hash,r.issued_snapshot as snapshot,r.direct_submission_evidence as evidence,r.confirmation_receipt as receipt,r.submitted_at as "submittedAt",r.confirmation_observed_at as "observedAt",r.confirmation_observed_at<>date_trunc('milliseconds',r.confirmation_observed_at) as "subMillisecond",em.subject_snapshot as subject,em.html_snapshot as html,em.text_snapshot as text,em.outreach_guarded_claim as guarded,(r.issued_snapshot->'campaign'=m.confirmed_snapshot) as "sameSnapshot",
    exists(select 1 from growth.resend_delivery_events d where d.outreach_reservation_id=r.id and d.outreach_connection_id=r.connection_id and d.event_type='email.delivered' and d.email_message_id=em.id and d.recipient_normalised_email=r.issued_snapshot->>'recipient' and d.provider_event_id=r.confirmation_receipt->>'providerEventId' and d.outreach_rfc_message_id=em.rfc_message_id and d.outreach_body_sha256=r.confirmation_receipt->>'bodySha256' and d.outreach_webhook_generation::text=r.confirmation_receipt->>'webhookGeneration') as "deliveryMatches"
    from growth.campaign_memberships m join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id
    join growth.email_messages em on em.sequence_enrollment_id=se.id and em.step_number=${step} and em.channel='resend' and em.direction='outbound'
    join growth.outreach_reservations r on r.email_message_id=em.id and r.membership_id=m.id and r.sequence_id=se.id and r.campaign_id=m.campaign_id and r.policy_version=m.policy_version
    where m.id=${membershipId} and r.connection_id=${connectionId} and r.outreach_provider='resend' and r.status='accepted' and r.confirmation_observed_at is not null
      and (${step}<>0 or r.id=m.first_confirmation_reservation_id) order by r.id limit 2`;
}

// Caller holds routing, account, campaign, membership and message locks.
export async function loadResendFollowUpAnchor(
  tx: GrowthTransaction,
  input: {
    membershipId: string;
    connectionId: string;
    step: 1 | 2;
    runtime: ResendRuntimeConfiguration;
  },
) {
  const account = await loadResendAccountReadiness(
    tx,
    input.connectionId,
    input.runtime,
  );
  if (account.status !== "ready") return null;
  const firstRows = await readReceipt(
    tx,
    input.membershipId,
    input.connectionId,
    0,
  );
  if (firstRows.length !== 1) return null;
  const first = validateReceipt(firstRows[0], input, account.monitoredMailbox);
  if (
    !first ||
    !first.row.sameSnapshot ||
    !first.campaign.copyFamilyVersion ||
    !first.campaign.copyFamilySha256
  )
    return null;
  const references = [first.rfc];
  if (input.step === 2) {
    const priorRows = await readReceipt(
      tx,
      input.membershipId,
      input.connectionId,
      1,
    );
    if (priorRows.length !== 1) return null;
    const prior = validateReceipt(
      priorRows[0],
      input,
      account.monitoredMailbox,
    );
    if (
      !prior ||
      prior.row.subject !== first.row.subject ||
      JSON.stringify({
        ...prior.campaign,
        copySha256: first.campaign.copySha256,
      }) !== JSON.stringify(first.campaign)
    )
      return null;
    let body: unknown;
    try {
      body = JSON.parse(prior.snapshot.rawBody);
    } catch {
      return null;
    }
    const headers = z
      .object({
        headers: z.object({
          "In-Reply-To": z.string(),
          References: z.string(),
        }),
      })
      .safeParse(body);
    if (
      !headers.success ||
      headers.data.headers["In-Reply-To"] !== first.rfc ||
      headers.data.headers.References !== first.rfc ||
      prior.rfc === first.rfc
    )
      return null;
    references.push(prior.rfc);
  }
  return {
    campaign: first.campaign,
    submittedAt: first.row.submittedAt,
    observedAt: first.row.observedAt,
    schedulingAnchor: campaignSchedulingAnchor(
      first.row.observedAt,
      "resend_fss_delivery_observed",
      first.row.subMillisecond,
    ),
    subject: first.row.subject,
    monitoredMailbox: account.monitoredMailbox,
    references,
  };
}

function validateReceipt(
  row: Row | undefined,
  input: {
    membershipId: string;
    connectionId: string;
    runtime: ResendRuntimeConfiguration;
  },
  monitor: z.infer<typeof monitorSchema>,
) {
  const snapshot = snapshotSchema.safeParse(row?.snapshot),
    receipt = receiptSchema.safeParse(row?.receipt);
  if (
    !row ||
    !row.guarded ||
    !row.deliveryMatches ||
    !snapshot.success ||
    !receipt.success ||
    !row.submittedAt ||
    !row.observedAt ||
    !row.subject ||
    !row.html ||
    !row.text
  )
    return null;
  const data = snapshot.data,
    proof = receipt.data;
  const rfc = parseGmailReferences(row.rfc, null);
  if (
    rfc.kind !== "valid" ||
    rfc.ids.length !== 1 ||
    rfc.ids[0] !== row.rfc ||
    JSON.stringify(data.monitoredMailbox) !== JSON.stringify(monitor) ||
    data.accountId !== row.accountId ||
    data.connectionId !== input.connectionId ||
    data.connectionId !== row.connectionId ||
    data.sendGeneration !== row.generation ||
    data.idempotencyKey !== row.key ||
    data.messageId !== row.messageId ||
    data.sequenceId !== row.sequenceId ||
    data.membershipId !== input.membershipId ||
    data.from !== input.runtime.binding.sender ||
    data.replyTo !== monitor.address ||
    data.recipient !== data.campaign.effectiveRecipient.email ||
    data.bodySha256 !== row.hash ||
    createHash("sha256").update(data.rawBody).digest("hex") !== row.hash ||
    proof.providerMessageId !== row.providerId ||
    row.messageProviderId !== row.providerId ||
    proof.connectionId !== row.connectionId ||
    proof.sendGeneration !== row.generation ||
    proof.rfcMessageId !== row.rfc ||
    new Date(proof.possibleInvocationFrom).getTime() !==
      row.submittedAt.getTime() ||
    new Date(proof.observedAt).getTime() !== row.observedAt.getTime() ||
    createHash("sha256")
      .update(JSON.stringify([row.subject, row.html, row.text]))
      .digest("hex") !== data.campaign.copySha256 ||
    data.campaign.membershipId !== input.membershipId ||
    !matchesResendSubmissionEvidence(row.evidence, {
      version: 1,
      kind: "resend_api_send_email_v1",
      reservationId: row.id,
      accountId: row.accountId,
      connectionId: row.connectionId,
      sendGeneration: row.generation,
      idempotencyKey: row.key,
      bodySha256: row.hash,
      providerMessageId: row.providerId,
    })
  )
    return null;
  return { row, snapshot: data, campaign: data.campaign, rfc: row.rfc };
}
