import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import { sameAccountScopes } from "../integrations/google-oauth";
import { matchesDirectSubmissionEvidence } from "../campaigns/direct-submission-evidence";
import { matchesResendSubmissionEvidence } from "../campaigns/resend-reservation-evidence";
import type { ProvenReference } from "./gmail-routing";

const monitorSchema = z.object({
  connectionId: z.uuid(),
  googleSubject: z.string().min(1),
  grantEpoch: z.number().int().positive(),
  address: z.email(),
  grantedScopes: z.array(z.string()).min(1),
});
const gmailSnapshotSchema = z.object({
  from: z.email(),
  recipient: z.email(),
  connectionId: z.uuid(),
  googleSubject: z.string().min(1),
  grantEpoch: z.number().int().positive(),
  rfcMessageId: z.string(),
  rawSha256: z.string(),
});
const resendSnapshotSchema = z.object({
  recipient: z.email(),
  replyTo: z.email(),
  accountId: z.uuid(),
  connectionId: z.uuid(),
  sendGeneration: z.uuid(),
  idempotencyKey: z.string(),
  bodySha256: z.string(),
  monitoredMailbox: monitorSchema,
  campaign: z.object({
    effectiveRecipient: z.object({ email: z.email(), contactId: z.uuid() }),
    reviewedRecipient: z.object({ email: z.email(), contactId: z.uuid() }),
  }),
});
const gmailReceiptSchema = z.object({
  basis: z.literal("gmail_fss_sent_observed"),
  providerMessageId: z.string(),
  providerThreadId: z.string(),
  rfcMessageId: z.string(),
  googleSubject: z.string(),
  rawSha256: z.string(),
  observationGrantEpoch: z.number().int().positive(),
});
const resendReceiptSchema = z.object({
  basis: z.literal("resend_fss_delivery_observed"),
  providerMessageId: z.string(),
  providerEventId: z.string(),
  bodySha256: z.string(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  webhookGeneration: z.uuid(),
  sendGeneration: z.uuid(),
});

type ProvenRow = {
  id: string;
  channel: string;
  sequenceId: string;
  status: string;
  prospectId: string;
  contactId: string;
  contactEmail: string;
  rfc: string;
  accountId: string;
  connectionId: string;
  grantEpoch: number | null;
  generation: string | null;
  key: string;
  hash: string;
  providerId: string;
  threadId: string | null;
  snapshot: unknown;
  evidence: unknown;
  receipt: unknown;
  deliveryMatches: boolean;
  membershipMatches: boolean;
};

export async function loadProvenReferences(
  tx: GrowthTransaction,
  ids: string[],
  from: string,
  binding: GmailGrantBinding,
  mailboxAddress: string,
): Promise<ProvenReference[]> {
  const rows = await tx<ProvenRow[]>`
    select r.id,em.channel,se.id as "sequenceId",se.status,se.prospect_id as "prospectId",se.contact_id as "contactId",ct.normalised_email as "contactEmail",
      em.rfc_message_id as rfc,r.account_id as "accountId",r.connection_id as "connectionId",r.grant_epoch as "grantEpoch",r.resend_send_generation as generation,
      r.idempotency_key as key,r.issued_snapshot_hash as hash,r.provider_message_id as "providerId",r.provider_thread_id as "threadId",r.issued_snapshot as snapshot,
      r.direct_submission_evidence as evidence,r.confirmation_receipt as receipt,
      exists(select 1 from growth.campaign_memberships m where m.id=r.membership_id and m.sequence_id=se.id and m.prospect_id=se.prospect_id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version) as "membershipMatches",
      exists(select 1 from growth.resend_delivery_events d where d.outreach_reservation_id=r.id and d.outreach_connection_id=r.connection_id
        and d.event_type='email.delivered' and d.email_message_id=em.id and d.recipient_normalised_email=${from}
        and d.provider_event_id=r.confirmation_receipt->>'providerEventId' and d.outreach_rfc_message_id=em.rfc_message_id
        and d.outreach_body_sha256=r.confirmation_receipt->>'bodySha256' and d.outreach_webhook_generation::text=r.confirmation_receipt->>'webhookGeneration') as "deliveryMatches"
    from growth.outreach_reservations r join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=r.sequence_id
    join growth.sequence_enrollments se on se.id=r.sequence_id and se.prospect_id=em.prospect_id and se.contact_id=em.contact_id
    join growth.contacts ct on ct.id=se.contact_id
    where em.direction='outbound' and em.rfc_message_id=any(${tx.array(ids)}::text[]) and em.provider_message_id=r.provider_message_id
      and r.status='accepted' and r.confirmation_observed_at is not null and r.direct_submission_evidence is not null
    order by r.id limit 101`;
  const matches: ProvenReference[] = [];
  for (const row of rows) {
    if (row.contactEmail !== from) continue;
    if (row.channel === "gmail") {
      const snapshot = gmailSnapshotSchema.safeParse(row.snapshot),
        receipt = gmailReceiptSchema.safeParse(row.receipt);
      if (
        !snapshot.success ||
        !receipt.success ||
        row.connectionId !== binding.connectionId ||
        row.grantEpoch !== binding.grantEpoch ||
        snapshot.data.connectionId !== binding.connectionId ||
        snapshot.data.from !== mailboxAddress ||
        snapshot.data.googleSubject !== binding.googleSubject ||
        snapshot.data.grantEpoch !== binding.grantEpoch ||
        snapshot.data.recipient !== from ||
        snapshot.data.rfcMessageId !== row.rfc ||
        snapshot.data.rawSha256 !== row.hash ||
        receipt.data.observationGrantEpoch !== binding.grantEpoch ||
        receipt.data.googleSubject !== binding.googleSubject ||
        receipt.data.providerMessageId !== row.providerId ||
        receipt.data.providerThreadId !== row.threadId ||
        receipt.data.rfcMessageId !== row.rfc ||
        receipt.data.rawSha256 !== row.hash ||
        !matchesDirectSubmissionEvidence(row.evidence, {
          version: 1,
          kind: "gmail_api_send_message_v1",
          reservationId: row.id,
          accountId: row.accountId,
          connectionId: row.connectionId,
          googleSubject: binding.googleSubject,
          grantEpoch: row.grantEpoch,
          rfcMessageId: row.rfc,
          rawSha256: row.hash,
          providerMessageId: row.providerId,
          providerThreadId: row.threadId,
        })
      )
        continue;
    } else if (row.channel === "resend") {
      const snapshot = resendSnapshotSchema.safeParse(row.snapshot),
        receipt = resendReceiptSchema.safeParse(row.receipt);
      if (
        !snapshot.success ||
        !receipt.success ||
        !row.deliveryMatches ||
        !row.membershipMatches
      )
        continue;
      const monitor = snapshot.data.monitoredMailbox;
      if (
        monitor.connectionId !== binding.connectionId ||
        monitor.googleSubject !== binding.googleSubject ||
        monitor.grantEpoch !== binding.grantEpoch ||
        !sameAccountScopes(monitor.grantedScopes, binding.grantedScopes) ||
        monitor.address !== snapshot.data.replyTo ||
        monitor.address !== mailboxAddress ||
        snapshot.data.recipient !== from ||
        snapshot.data.campaign.effectiveRecipient.email !== from ||
        snapshot.data.campaign.reviewedRecipient.email !== from ||
        snapshot.data.campaign.effectiveRecipient.contactId !== row.contactId ||
        snapshot.data.campaign.reviewedRecipient.contactId !== row.contactId ||
        snapshot.data.accountId !== row.accountId ||
        snapshot.data.connectionId !== row.connectionId ||
        snapshot.data.sendGeneration !== row.generation ||
        snapshot.data.idempotencyKey !== row.key ||
        snapshot.data.bodySha256 !== row.hash ||
        receipt.data.providerMessageId !== row.providerId ||
        receipt.data.connectionId !== row.connectionId ||
        receipt.data.sendGeneration !== row.generation ||
        receipt.data.rfcMessageId !== row.rfc ||
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
        continue;
    } else continue;
    matches.push({
      enrollment: {
        id: row.sequenceId,
        status: row.status,
        prospectId: row.prospectId,
        contactId: row.contactId,
      },
      attribution: {
        basis: "gmail_exact_reference_v1",
        outboundProvider: row.channel,
        reservationId: row.id,
        rfcMessageId: row.rfc,
        connectionId: binding.connectionId,
        googleSubject: binding.googleSubject,
        grantEpoch: binding.grantEpoch,
        recipient: from,
      },
    });
  }
  return matches;
}
