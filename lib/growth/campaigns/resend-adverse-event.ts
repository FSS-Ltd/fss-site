import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { classifyResendOutreachAdverse } from "../integrations/resend/outreach-adverse-evidence";
import {
  verifyResendWebhookSignature,
  type ResendWebhookHeaders,
} from "../integrations/resend/webhook";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { createSequenceStopTransaction } from "../sequences/stop-repository";
import { stopSequenceInTransaction } from "../sequences/stop";
import { resendBindingSchema } from "./resend-account-readiness";
import { verifyResendIssuer } from "./resend-issuer-verifier";
import { cancelCampaignJobs } from "./lifecycle";
import { held, type ReservationOutcome } from "./reservation-shared";

const configSchema = z.object({
  connectionId: z.uuid(),
  binding: resendBindingSchema,
  webhookSecret: z.string().trim().min(1),
});
export function createResendAdverseEventHandler(
  db: GrowthDb,
  rawConfig: z.input<typeof configSchema>,
) {
  const config = configSchema.parse(rawConfig);
  return async (
    rawBody: string,
    headers: ResendWebhookHeaders,
  ): Promise<ReservationOutcome<{ ignored: boolean; replay: boolean }>> => {
    if (!config.binding.webhookGeneration)
      return held("webhook_binding_unknown");
    if (Buffer.byteLength(rawBody, "utf8") > 1_048_576)
      return held("adverse_unverified");
    const verified = verifyResendWebhookSignature(
      rawBody,
      headers,
      config.webhookSecret,
    );
    const parsed = classifyResendOutreachAdverse(verified, {
      connectionId: config.connectionId,
      team: config.binding.team,
      environment: config.binding.environment,
      sender: config.binding.sender,
      webhookGeneration: config.binding.webhookGeneration,
    });
    if (parsed.kind === "invalid") return held("adverse_unverified");
    if (parsed.kind === "ignored")
      return { status: "ready", value: { ignored: true, replay: false } };
    const { candidate, eventType, reason } = parsed;
    return withGrowthTransaction(db, async (tx) => {
      // Lock every currently related campaign before the business lock, matching
      // campaign writers. The global lock fences new routing and send authority.
      await lockGmailRouting(tx);
      await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
      const identities = await tx<
        { businessId: string }[]
      >`select m.business_id as "businessId" from growth.outreach_reservations r join growth.campaign_memberships m on m.id=r.membership_id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version where r.connection_id=${candidate.connectionId} and r.outreach_provider='resend' and r.provider_message_id=${candidate.providerMessageId} limit 2`;
      if (identities.length !== 1)
        return held(identities.length ? "issuer_ambiguous" : "issuer_unknown");
      const businessId = identities[0].businessId;
      const campaigns = await tx<
        { id: string }[]
      >`select distinct campaign_id as id from growth.campaign_memberships where business_id=${businessId} order by campaign_id limit 101`;
      if (campaigns.length > 100) return held("business_scope_exceeded");
      for (const campaign of campaigns)
        await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${campaign.id}`},0))`;
      const issuer = await verifyResendIssuer(tx, config, candidate, {
        allowMissingCopyFamily: true,
      });
      if (issuer.status === "held") return issuer;
      const { identity, row, member } = issuer.value;
      if (identity.businessId !== businessId) return held("business_changed");
      const memberships = await tx<
        { id: string; campaignId: string }[]
      >`select id,campaign_id as "campaignId" from growth.campaign_memberships where business_id=${businessId} order by campaign_id,id limit 501`;
      const lockedCampaigns = new Set(campaigns.map((campaign) => campaign.id));
      if (memberships.length > 500) return held("business_scope_exceeded");
      if (
        memberships.some(
          (membership) => !lockedCampaigns.has(membership.campaignId),
        )
      )
        return held("business_scope_changed");
      const [prior] = await tx<
        {
          reservationId: string | null;
          hash: string | null;
          generation: string | null;
          rfc: string | null;
          type: string;
          recipient: string;
        }[]
      >`
        select outreach_reservation_id as "reservationId",outreach_body_sha256 as hash,outreach_webhook_generation as generation,outreach_rfc_message_id as rfc,event_type as type,recipient_normalised_email as recipient from growth.resend_delivery_events where provider_event_id=${candidate.providerEventId}`;
      if (prior) {
        if (
          prior.reservationId !== identity.id ||
          prior.hash !== candidate.bodySha256 ||
          prior.generation !== candidate.webhookGeneration ||
          prior.rfc !== candidate.rfcMessageId ||
          prior.type !== eventType ||
          prior.recipient !== candidate.recipient
        )
          return held("adverse_conflict");
        return { status: "ready", value: { ignored: false, replay: true } };
      }
      const [time] = await tx<
        { valid: boolean }[]
      >`select (${candidate.providerEventCreatedAt}::text::timestamptz>=submitted_at and ${candidate.providerEventCreatedAt}::text::timestamptz<=clock_timestamp() and (${candidate.providerMessageCreatedAt}::text is null or (${candidate.providerMessageCreatedAt}::text::timestamptz>=submitted_at and ${candidate.providerMessageCreatedAt}::text::timestamptz<=${candidate.providerEventCreatedAt}::text::timestamptz))) as valid from growth.outreach_reservations where id=${identity.id}`;
      if (!time?.valid) return held("adverse_time_unknown");
      const sequences = await tx<
        { id: string; status: string }[]
      >`select se.id,se.status from growth.sequence_enrollments se join growth.prospects p on p.id=se.prospect_id where p.business_id=${businessId} order by se.id limit 501`;
      if (sequences.length > 500) return held("business_scope_exceeded");
      const stop = createSequenceStopTransaction(tx);
      const correlationId =
        candidate.providerEventId.length <= 200
          ? candidate.providerEventId
          : createHash("sha256")
              .update(candidate.providerEventId)
              .digest("hex");
      const actor = {
        type: "resend_webhook" as const,
        id: candidate.providerEventId,
      };
      for (const sequence of sequences) {
        const locked = await stop.lockEnrollment(sequence.id);
        if (!locked) throw new Error("sequence_disappeared");
        if (
          sequence.id === member.sequenceId &&
          locked.normalisedEmail === candidate.recipient &&
          ["pending_approval", "active", "paused"].includes(locked.status)
        ) {
          await stopSequenceInTransaction(stop, {
            sequenceId: sequence.id,
            reason,
            actor,
            correlationId,
          });
        } else {
          await stop.cancelPendingMessages(sequence.id);
          if (["pending_approval", "active"].includes(locked.status))
            await stopSequenceInTransaction(stop, {
              sequenceId: sequence.id,
              reason: "pause",
              actor,
              correlationId,
            });
        }
      }
      // Email scope and business scope coexist in the canonical suppression store.
      await stop.insertDoNotContactSuppression({
        normalisedEmail: candidate.recipient,
        businessId,
        reason,
        source: "resend_webhook",
        createdBy: candidate.providerEventId,
      });
      await tx`insert into growth.suppressions(normalised_email,business_id,reason,source,created_by) values (null,${businessId},${reason},'resend_webhook',${candidate.providerEventId}) on conflict (business_id) where normalised_email is null do nothing`;
      for (const membership of memberships)
        await cancelCampaignJobs(tx, membership.campaignId, membership.id);
      await tx`update growth.campaign_memberships set status='stopped',updated_at=clock_timestamp() where business_id=${businessId} and status in ('active','paused','review')`;
      await tx`update growth.outreach_account_controls set state='halted',health_review_id=null,version=version+1,updated_at=clock_timestamp() where connection_id=${candidate.connectionId} and provider='resend' and (state<>'halted' or health_review_id is not null)`;
      await tx`insert into growth.resend_delivery_events(provider_event_id,event_type,occurred_at,recipient_normalised_email,email_message_id,sanitised_payload,outreach_reservation_id,outreach_connection_id,outreach_webhook_generation,outreach_body_sha256,outreach_rfc_message_id) values (${candidate.providerEventId},${eventType},${candidate.providerEventCreatedAt}::text::timestamptz,${candidate.recipient},${row.messageId},${tx.json({ event_type: eventType, provider_message_id: candidate.providerMessageId })},${identity.id},${candidate.connectionId},${candidate.webhookGeneration},${candidate.bodySha256},${candidate.rfcMessageId})`;
      const eventId = randomUUID();
      await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${eventId},${identity.campaignId},${identity.policyVersion},${identity.membershipId},${eventType === "email.bounced" ? "resend_hard_bounce" : "resend_complaint"})`;
      await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${eventId})`;
      await appendAuditEvent(tx, {
        correlationId,
        actorType: "provider",
        actorId: "resend_webhook",
        action: "outreach_account.provider_halt",
        entityType: "outreach_account",
        entityId: candidate.connectionId,
        metadata: {
          reasonCode:
            eventType === "email.bounced"
              ? "resend_hard_bounce"
              : "resend_complaint",
        },
      });
      return { status: "ready", value: { ignored: false, replay: false } };
    });
  };
}
