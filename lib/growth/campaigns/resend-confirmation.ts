import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { extractResendDeliveryCandidate } from "../integrations/resend/outreach-delivery-evidence";
import {
  verifyResendWebhookSignature,
  type ResendWebhookHeaders,
} from "../integrations/resend/webhook";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import {
  campaignSchema,
  freezeCampaignConfirmation,
} from "./gmail-confirmation-campaign";
import { campaignSchedulingAnchor } from "./time";
import { resendBindingSchema } from "./resend-account-readiness";
import { matchesResendSubmissionEvidence } from "./resend-reservation-evidence";
import { held, type ReservationOutcome } from "./reservation-shared";

const issuedSchema = z.object({
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
      await lockGmailRouting(tx);
      await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
      const identities = await tx<
        {
          id: string;
          campaignId: string;
          policyVersion: number;
          membershipId: string;
          businessId: string;
        }[]
      >`
        select r.id,r.campaign_id as "campaignId",r.policy_version as "policyVersion",r.membership_id as "membershipId",m.business_id as "businessId"
        from growth.outreach_reservations r join growth.campaign_memberships m on m.id=r.membership_id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version
        where r.connection_id=${candidate.connectionId} and r.outreach_provider='resend' and r.provider_message_id=${candidate.providerMessageId} limit 2`;
      if (identities.length !== 1)
        return held(identities.length ? "issuer_ambiguous" : "issuer_unknown");
      const identity = identities[0];
      await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
      await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
      const [control] = await tx<
        { binding: unknown; review: unknown; sender: string }[]
      >`
        select c.resend_binding as binding,ar.evidence as review,ic.subject_email as sender
        from growth.outreach_account_controls c join growth.integration_connections ic on ic.id=c.connection_id and ic.provider='resend'
        join growth.outreach_account_reviews ar on ar.id=c.resend_binding_review_id and ar.connection_id=c.connection_id and ar.kind='resend_configure' and ar.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")}
        where c.connection_id=${candidate.connectionId} and c.provider='resend' for share of c,ic`;
      const binding = resendBindingSchema.safeParse(control?.binding);
      const review = z
        .object({ binding: resendBindingSchema })
        .safeParse(control?.review);
      if (
        !control ||
        !binding.success ||
        !review.success ||
        JSON.stringify(binding.data) !== JSON.stringify(review.data.binding) ||
        JSON.stringify(binding.data) !== JSON.stringify(config.binding) ||
        control.sender !== candidate.sender ||
        binding.data.webhookGeneration !== candidate.webhookGeneration
      )
        return held("webhook_binding_unknown");
      await tx`select id from growth.campaigns where id=${identity.campaignId} and version=${identity.policyVersion} for share`;
      const [member] = await tx<
        {
          status: string;
          first: string | null;
          sequenceId: string;
          prospectId: string;
        }[]
      >`
        select status,first_confirmation_reservation_id as first,sequence_id as "sequenceId",prospect_id as "prospectId"
        from growth.campaign_memberships where id=${identity.membershipId} and campaign_id=${identity.campaignId} and policy_version=${identity.policyVersion} for update`;
      if (!member?.sequenceId) return held("membership_unknown");
      const [row] = await tx<
        {
          status: string;
          snapshot: unknown;
          hash: string;
          evidence: unknown;
          accountId: string;
          connectionId: string;
          generation: string;
          key: string;
          messageId: string;
          sequenceId: string;
          providerId: string;
          submittedAt: Date;
          receipt: unknown;
          observedAt: Date | null;
        }[]
      >`
        select status,issued_snapshot as snapshot,issued_snapshot_hash as hash,direct_submission_evidence as evidence,account_id as "accountId",connection_id as "connectionId",resend_send_generation as generation,idempotency_key as key,email_message_id as "messageId",sequence_id as "sequenceId",provider_message_id as "providerId",submitted_at as "submittedAt",confirmation_receipt as receipt,confirmation_observed_at as "observedAt" from growth.outreach_reservations where id=${identity.id} for update`;
      const issued = issuedSchema.safeParse(row?.snapshot);
      if (
        !row ||
        row.status !== "accepted" ||
        !issued.success ||
        !row.submittedAt ||
        issued.data.accountId !== row.accountId ||
        issued.data.connectionId !== row.connectionId ||
        issued.data.sendGeneration !== row.generation ||
        issued.data.idempotencyKey !== row.key ||
        issued.data.messageId !== row.messageId ||
        issued.data.sequenceId !== row.sequenceId ||
        issued.data.membershipId !== identity.membershipId ||
        issued.data.campaign.campaignId !== identity.campaignId ||
        issued.data.campaign.policyVersion !== identity.policyVersion ||
        issued.data.campaign.membershipId !== identity.membershipId ||
        issued.data.from !== candidate.sender ||
        issued.data.replyTo !== binding.data.replyTo ||
        issued.data.recipient !== candidate.recipient ||
        row.generation !== binding.data.sendGeneration ||
        issued.data.bodySha256 !== row.hash ||
        createHash("sha256")
          .update(issued.data.rawBody, "utf8")
          .digest("hex") !== row.hash ||
        !matchesResendSubmissionEvidence(row.evidence, {
          version: 1,
          kind: "resend_api_send_email_v1",
          reservationId: identity.id,
          accountId: row.accountId,
          connectionId: row.connectionId,
          sendGeneration: row.generation,
          idempotencyKey: row.key,
          bodySha256: row.hash,
          providerMessageId: row.providerId,
        })
      )
        return held("issuer_unproven");
      const campaign = issued.data.campaign;
      const [message] = await tx<
        {
          step: number;
          status: string;
          sequenceStatus: string;
          prospectId: string;
          contactId: string;
          providerId: string | null;
          rfc: string | null;
          hasReply: boolean;
        }[]
      >`
        select em.step_number as step,em.status,se.status as "sequenceStatus",em.prospect_id as "prospectId",em.contact_id as "contactId",em.provider_message_id as "providerId",em.rfc_message_id as rfc,
          exists(select 1 from growth.email_messages incoming where incoming.sequence_enrollment_id=se.id and incoming.direction='inbound' and incoming.status='received') as "hasReply"
        from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id and se.prospect_id=em.prospect_id and se.contact_id=em.contact_id
        where em.id=${row.messageId} and se.id=${row.sequenceId} and em.channel='resend' and em.direction='outbound' for update of em,se`;
      if (
        !message ||
        member.sequenceId !== row.sequenceId ||
        member.prospectId !== message.prospectId ||
        campaign.businessId !== identity.businessId ||
        campaign.effectiveRecipient.contactId !== message.contactId ||
        campaign.reviewedRecipient.contactId !== message.contactId ||
        campaign.effectiveRecipient.email !== candidate.recipient ||
        !campaign.copyFamilyVersion ||
        !campaign.copyFamilySha256 ||
        (message.providerId !== null &&
          message.providerId !== candidate.providerMessageId) ||
        (message.rfc !== null && message.rfc !== candidate.rfcMessageId)
      )
        return held("membership_conflict");
      const [messageConflict] = await tx<
        { found: boolean }[]
      >`select exists(select 1 from growth.email_messages where id<>${row.messageId} and (rfc_message_id=${candidate.rfcMessageId} or (channel='resend' and provider_message_id=${candidate.providerMessageId}))) as found`;
      if (!messageConflict || messageConflict.found)
        return held("message_conflict");
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
      >`select id from growth.resend_delivery_events where outreach_reservation_id=${identity.id} or (outreach_connection_id=${candidate.connectionId} and outreach_rfc_message_id=${candidate.rfcMessageId})`;
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
