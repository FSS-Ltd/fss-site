import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { extractResendDeliveryCandidate } from "../integrations/resend/outreach-delivery-evidence";
import {
  verifyResendWebhookSignature,
  type ResendWebhookHeaders,
} from "../integrations/resend/webhook";
import { freezeCampaignConfirmation } from "./gmail-confirmation-campaign";
import { verifyResendIssuer } from "./resend-issuer-verifier";
import { campaignSchedulingAnchor } from "./time";
import { resendBindingSchema } from "./resend-account-readiness";
import { held, type ReservationOutcome } from "./reservation-shared";

const receiptSchema = z.object({
  basis: z.literal("resend_fss_delivery_observed"),
  providerMessageId: z.string(),
  providerEventId: z.string(),
  bodySha256: z.string(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  webhookGeneration: z.uuid(),
  sendGeneration: z.uuid(),
  providerEventCreatedAt: z.iso.datetime({ offset: true }),
  providerMessageCreatedAt: z.iso.datetime({ offset: true }).nullable(),
  observedAt: z.iso.datetime({ offset: true }),
  possibleInvocationFrom: z.iso.datetime({ offset: true }),
});
const configurationSchema = z.object({
  connectionId: z.uuid(),
  binding: resendBindingSchema,
  webhookSecret: z.string().trim().min(1),
});
export type ResendReceipt = z.infer<typeof receiptSchema>;

/** Server-only factory: raw Svix verification is performed here, never by a caller-supplied candidate. */
export function createResendConfirmation(
  db: GrowthDb,
  rawConfiguration: z.input<typeof configurationSchema>,
) {
  const config = configurationSchema.parse(rawConfiguration);
  return async (
    rawBody: string,
    headers: ResendWebhookHeaders,
  ): Promise<
    ReservationOutcome<{
      reservationId: string;
      receipt: ResendReceipt;
      replay: boolean;
    }>
  > => {
    if (!config.binding.webhookGeneration)
      return held("webhook_binding_unknown");
    if (Buffer.byteLength(rawBody, "utf8") > 1_048_576)
      return held("delivery_unverified");
    const verified = verifyResendWebhookSignature(
      rawBody,
      headers,
      config.webhookSecret,
    );
    const candidate = extractResendDeliveryCandidate({
      verified,
      binding: {
        connectionId: config.connectionId,
        team: config.binding.team,
        environment: config.binding.environment,
        sender: config.binding.sender,
        webhookGeneration: config.binding.webhookGeneration,
      },
    });
    if (!candidate) return held("delivery_unverified");
    return withGrowthTransaction(db, async (tx) => {
      const issuer = await verifyResendIssuer(tx, config, candidate);
      if (issuer.status === "held") return issuer;
      const { identity, row, member, message, campaign } = issuer.value;
      if (!member.first && message.step === 0) {
        const [existing] = await tx<
          { found: boolean }[]
        >`select exists(select 1 from growth.email_messages where sequence_enrollment_id=${row.sequenceId} and direction='outbound' and step_number in (1,2)) as found`;
        const reports = await tx<
          { memberId: string | null; anchorId: string | null }[]
        >`select membership_id as "memberId",anchor_reservation_id as "anchorId" from growth.outreach_jobs where campaign_id=${identity.campaignId} and job_type='monthly_report' limit 2 for update`;
        if (
          !existing ||
          existing.found ||
          reports.length > 1 ||
          reports.some(
            (report) => report.memberId !== null || report.anchorId === null,
          )
        )
          return held("campaign_lifecycle_conflict");
      }
      const [existingEvent] = await tx<
        {
          reservationId: string | null;
          hash: string | null;
          webhookGeneration: string | null;
        }[]
      >`select outreach_reservation_id as "reservationId",outreach_body_sha256 as hash,outreach_webhook_generation as "webhookGeneration" from growth.resend_delivery_events where provider_event_id=${candidate.providerEventId}`;
      if (row.receipt !== null) {
        const prior = receiptSchema.safeParse(row.receipt);
        if (
          !prior.success ||
          !row.observedAt ||
          prior.data.providerEventId !== candidate.providerEventId ||
          prior.data.bodySha256 !== candidate.bodySha256 ||
          prior.data.rfcMessageId !== candidate.rfcMessageId ||
          existingEvent?.reservationId !== identity.id ||
          existingEvent.hash !== candidate.bodySha256 ||
          existingEvent.webhookGeneration !== candidate.webhookGeneration
        )
          return held("delivery_conflict");
        if (!member.first && message.step === 0)
          return held("campaign_lifecycle_missing");
        return {
          status: "ready",
          value: {
            reservationId: identity.id,
            receipt: prior.data,
            replay: true,
          },
        };
      }
      if (existingEvent) return held("delivery_conflict");
      // Keep provider and observation timestamps at PostgreSQL microsecond
      // precision. JavaScript Date is used only for the conservative lower
      // exposure bound, which floors the stored submission to milliseconds.
      const [clock] = await tx<{ observedAt: string; valid: boolean }[]>`
        with observation as materialized (select clock_timestamp() as at)
        select to_char(observation.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "observedAt",
          (${candidate.providerEventCreatedAt}::text::timestamptz >= r.submitted_at
            and ${candidate.providerEventCreatedAt}::text::timestamptz <= observation.at
            and (${candidate.providerMessageCreatedAt}::text is null or
              (${candidate.providerMessageCreatedAt}::text::timestamptz >= r.submitted_at
                and ${candidate.providerMessageCreatedAt}::text::timestamptz <= ${candidate.providerEventCreatedAt}::text::timestamptz))) as valid
        from growth.outreach_reservations r cross join observation where r.id=${identity.id}`;
      if (!clock?.valid) return held("delivery_time_unknown");
      const receipt: ResendReceipt = {
        basis: "resend_fss_delivery_observed",
        providerMessageId: candidate.providerMessageId,
        providerEventId: candidate.providerEventId,
        bodySha256: candidate.bodySha256,
        rfcMessageId: candidate.rfcMessageId,
        connectionId: candidate.connectionId,
        webhookGeneration: candidate.webhookGeneration,
        sendGeneration: row.generation,
        providerEventCreatedAt: candidate.providerEventCreatedAt,
        providerMessageCreatedAt: candidate.providerMessageCreatedAt,
        observedAt: clock.observedAt,
        possibleInvocationFrom: row.submittedAt.toISOString(),
      };
      const [other] = await tx<
        { id: string }[]
      >`select id from growth.resend_delivery_events where event_type='email.delivered' and (outreach_reservation_id=${identity.id} or (outreach_connection_id=${candidate.connectionId} and outreach_rfc_message_id=${candidate.rfcMessageId}))`;
      if (other) return held("delivery_conflict");
      await tx`insert into growth.resend_delivery_events(provider_event_id,event_type,occurred_at,recipient_normalised_email,email_message_id,sanitised_payload,outreach_reservation_id,outreach_connection_id,outreach_webhook_generation,outreach_body_sha256,outreach_rfc_message_id) values (${candidate.providerEventId},'email.delivered',${candidate.providerEventCreatedAt}::text::timestamptz,${candidate.recipient},${row.messageId},${tx.json({ event_type: "email.delivered", provider_message_id: candidate.providerMessageId })},${identity.id},${candidate.connectionId},${candidate.webhookGeneration},${candidate.bodySha256},${candidate.rfcMessageId})`;

      await tx`update growth.outreach_reservations set confirmation_receipt=${tx.json(receipt)},confirmation_observed_at=${clock.observedAt}::text::timestamptz where id=${identity.id}`;
      await tx`update growth.email_messages set provider_message_id=${candidate.providerMessageId},rfc_message_id=${candidate.rfcMessageId} where id=${row.messageId}`;
      if (!member.first && message.step === 0) {
        const [fraction] = await tx<
          { sub: boolean }[]
        >`select confirmation_observed_at <> date_trunc('milliseconds',confirmation_observed_at) as sub from growth.outreach_reservations where id=${identity.id}`;
        if (!fraction) throw new Error("confirmation_missing");
        await freezeCampaignConfirmation(tx, {
          campaign,
          memberStatus:
            message.hasReply || message.status === "cancelled"
              ? "stopped"
              : member.status,
          sequenceStatus: message.sequenceStatus,
          policyReady: false,
          prospectId: message.prospectId,
          contactId: message.contactId,
          sequenceId: row.sequenceId,
          reservationId: identity.id,
          observedUntil: campaignSchedulingAnchor(
            new Date(clock.observedAt),
            receipt.basis,
            fraction.sub,
          ),
          provider: "resend",
        });
      }
      const event = identity.id;
      await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${event},${identity.campaignId},${identity.policyVersion},${identity.membershipId},'resend_delivery_observed')`;
      await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${event})`;
      await appendAuditEvent(tx, {
        correlationId: candidate.providerEventId,
        actorType: "provider",
        actorId: "resend_webhook",
        action: "outreach_reservation.resend_delivery_observed",
        entityType: "outreach_reservation",
        entityId: identity.id,
      });
      return {
        status: "ready",
        value: { reservationId: identity.id, receipt, replay: false },
      };
    });
  };
}
