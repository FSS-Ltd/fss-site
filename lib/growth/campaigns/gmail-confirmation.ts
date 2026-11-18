import {
  campaignSchema,
  freezeCampaignConfirmation,
} from "./gmail-confirmation-campaign";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockCurrentGmailGrant } from "../integrations/gmail/grant";
import {
  createBoundLiveGmailClient,
  type LiveGmailClientConfig,
} from "../integrations/gmail/live-client";
import {
  lockGmailRouting,
  lockGmailThread,
} from "../sequences/gmail-thread-association";
import { appendAuditEvent } from "../audit/service";
import { limitsReviewSchema } from "./account-contracts";
import { currentVisibilityExpiry } from "./account-repository";
import { held, type ReservationOutcome } from "./reservation-shared";
import { campaignPolicyDefinitionSchema } from "./schemas";
import { matchesDirectSubmissionEvidence } from "./direct-submission-evidence";
import {
  observeGmailConfirmation,
  type BoundReader,
  type VerifiedConfirmation,
} from "./gmail-confirmation-observation";

const receiptSchema = z.object({
  basis: z.literal("gmail_fss_sent_observed"),
  providerMessageId: z.string(),
  providerThreadId: z.string(),
  rfcMessageId: z.string(),
  googleSubject: z.string(),
  rawSha256: z.string(),
  observationGrantEpoch: z.number().int().positive(),
  providerCreatedAt: z.iso.datetime(),
});
export type GmailConfirmationResult = {
  reservationId: string;
  submissionMarkedAt: Date;
  anchor: {
    basis: "gmail_fss_sent_observed";
    observedAt: Date;
    observationGrantEpoch: number;
  };
  coverageOrigin: { kind: "unknown" };
  campaign: z.infer<typeof campaignSchema> | null;
};
async function persistGmailConfirmation(
  db: GrowthDb,
  fact: VerifiedConfirmation,
): Promise<ReservationOutcome<GmailConfirmationResult>> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await lockGmailThread(tx, fact.providerThreadId);
    const [initial] = await tx<
      {
        attemptKey: string;
        campaignId: string | null;
        businessId: string;
        messageId: string;
        sequenceId: string;
      }[]
    >`
      select r.idempotency_key as "attemptKey",r.campaign_id as "campaignId",p.business_id as "businessId",r.email_message_id as "messageId",r.sequence_id as "sequenceId"
      from growth.outreach_reservations r join growth.sequence_enrollments se on se.id=r.sequence_id join growth.prospects p on p.id=se.prospect_id where r.id=${fact.reservationId}`;
    if (!initial) return held("attempt_unknown");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-attempt:${initial.attemptKey}`},0))`;
    if (initial.campaignId)
      await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${initial.campaignId}`},0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${initial.businessId}`},0))`;
    try {
      await lockCurrentGmailGrant(tx, fact.binding);
    } catch (error) {
      if (error instanceof Error && error.message === "Gmail grant changed.")
        return held("observation_grant_changed");
      throw error;
    }
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (!clock || clock.now < fact.observedUntil)
      return held("observation_clock_invalid");
    const [visibility] = await tx<{ evidence: unknown }[]>`
      select r.evidence from growth.outreach_account_controls c join growth.outreach_account_reviews r on r.id=c.limits_review_id and r.connection_id=c.connection_id where c.connection_id=${fact.binding.connectionId} for share of c`;
    if (
      !visibility ||
      !currentVisibilityExpiry(
        visibility.evidence,
        fact.binding.googleSubject,
        fact.binding.grantedScopes,
        clock.now,
      )
    )
      return held("visibility_unknown");
    const review = z
      .object({ evidence: limitsReviewSchema })
      .safeParse(visibility.evidence);
    if (
      !review.success ||
      review.data.evidence.visibility?.supportedPaths?.fssGmailApi !==
        "included"
    )
      return held("visibility_unknown");
    const [row] = await tx<
      {
        status: string;
        connectionId: string | null;
        rfc: string | null;
        providerId: string | null;
        threadId: string | null;
        snapshot: unknown;
        hash: string | null;
        receipt: unknown;
        observedAt: Date | null;
        memberId: string | null;
        sequenceId: string;
        messageId: string;
        campaignId: string | null;
        policyVersion: number | null;
        submittedAt: Date | null;
        evidence: unknown;
        accountId: string;
        grantEpoch: number | null;
      }[]
    >`select status,connection_id as "connectionId",rfc_message_id as rfc,provider_message_id as "providerId",provider_thread_id as "threadId",issued_snapshot as snapshot,issued_snapshot_hash as hash,confirmation_receipt as receipt,confirmation_observed_at as "observedAt",membership_id as "memberId",sequence_id as "sequenceId",email_message_id as "messageId",campaign_id as "campaignId",policy_version as "policyVersion",submitted_at as "submittedAt",direct_submission_evidence as evidence,account_id as "accountId",grant_epoch as "grantEpoch" from growth.outreach_reservations where id=${fact.reservationId} for update`;
    const snapshot = z
      .object({
        googleSubject: z.string(),
        messageId: z.uuid(),
        sequenceId: z.uuid(),
        membershipId: z.uuid().nullable(),
        connectionId: z.uuid(),
        grantEpoch: z.number().int().positive(),
        rfcMessageId: z.string(),
        rawSha256: z.string(),
        campaign: campaignSchema.nullable(),
      })
      .safeParse(row?.snapshot);
    if (
      !row ||
      !row.submittedAt ||
      row.submittedAt > fact.observedFrom ||
      !snapshot.success ||
      row.connectionId !== fact.binding.connectionId ||
      row.rfc !== fact.rfcMessageId ||
      row.hash !== fact.rawSha256 ||
      snapshot.data.googleSubject !== fact.binding.googleSubject ||
      snapshot.data.messageId !== row.messageId ||
      snapshot.data.sequenceId !== row.sequenceId ||
      snapshot.data.membershipId !== row.memberId ||
      (row.providerId && row.providerId !== fact.providerMessageId) ||
      (row.threadId && row.threadId !== fact.providerThreadId)
    )
      return held("confirmation_conflict");
    const expectedEvidence = {
      version: 1,
      kind: "gmail_api_send_message_v1",
      reservationId: fact.reservationId,
      accountId: row.accountId,
      connectionId: row.connectionId,
      googleSubject: snapshot.data.googleSubject,
      grantEpoch: row.grantEpoch,
      rfcMessageId: row.rfc,
      rawSha256: row.hash,
      providerMessageId: fact.providerMessageId,
      providerThreadId: fact.providerThreadId,
    };
    if (
      row.status !== "accepted" ||
      snapshot.data.connectionId !== row.connectionId ||
      snapshot.data.grantEpoch !== row.grantEpoch ||
      snapshot.data.rfcMessageId !== row.rfc ||
      snapshot.data.rawSha256 !== row.hash ||
      !matchesDirectSubmissionEvidence(row.evidence, expectedEvidence) ||
      !matchesDirectSubmissionEvidence(
        row.evidence,
        fact.directSubmissionEvidence,
      )
    )
      return held("direct_submission_unproven");
    const [message] = await tx<
      {
        prospectId: string;
        contactId: string;
        step: number;
        providerId: string | null;
        threadId: string | null;
        rfc: string | null;
        sequenceThread: string | null;
        sequenceStatus: string;
        providerDraftId: string | null;
      }[]
    >`
      select em.prospect_id as "prospectId",em.contact_id as "contactId",em.step_number as step,em.provider_message_id as "providerId",em.provider_thread_id as "threadId",em.rfc_message_id as rfc,se.gmail_thread_id as "sequenceThread",se.status as "sequenceStatus",em.provider_draft_id as "providerDraftId"
      from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id where em.id=${row.messageId} and se.id=${row.sequenceId} for update of em,se`;
    if (
      !message ||
      message.rfc !== fact.rfcMessageId ||
      (message.providerId && message.providerId !== fact.providerMessageId) ||
      (message.threadId && message.threadId !== fact.providerThreadId) ||
      (message.sequenceThread &&
        message.sequenceThread !== fact.providerThreadId)
    )
      return held("association_conflict");
    const [conflict] = await tx<{ found: boolean }[]>`
      select exists(
        select 1 from growth.sequence_enrollments where gmail_thread_id=${fact.providerThreadId} and id<>${row.sequenceId}
        union all
        select 1 from growth.email_messages where provider_thread_id=${fact.providerThreadId} and sequence_enrollment_id<>${row.sequenceId}
        union all
        select 1 from growth.outreach_reservations where provider_thread_id=${fact.providerThreadId} and sequence_id<>${row.sequenceId}
        union all
        select 1 from growth.email_messages where channel='gmail' and provider_message_id=${fact.providerMessageId} and id<>${row.messageId}
        union all
        select 1 from growth.outreach_reservations where connection_id=${fact.binding.connectionId} and provider_message_id=${fact.providerMessageId} and id<>${fact.reservationId}
      ) as found`;
    if (!conflict || conflict.found) return held("association_conflict");
    const campaign = snapshot.data.campaign;
    if (campaign && message.providerDraftId)
      return held("provider_draft_uncontrolled");
    if (
      (row.memberId === null) !== (campaign === null) ||
      (campaign &&
        (campaign.membershipId !== row.memberId ||
          campaign.campaignId !== row.campaignId ||
          campaign.policyVersion !== row.policyVersion ||
          campaign.businessId !== initial.businessId))
    )
      return held("membership_conflict");
    const [member] = row.memberId
      ? await tx<
          { status: string; first: string | null }[]
        >`select status,first_confirmation_reservation_id as first from growth.campaign_memberships where id=${row.memberId} and sequence_id=${row.sequenceId} and campaign_id=${row.campaignId} and policy_version=${row.policyVersion} for update`
      : [null];
    if (row.memberId && !member) return held("membership_conflict");
    if (row.receipt !== null) {
      const receipt = receiptSchema.safeParse(row.receipt);
      if (
        !receipt.success ||
        !row.observedAt ||
        receipt.data.providerMessageId !== fact.providerMessageId ||
        receipt.data.providerThreadId !== fact.providerThreadId ||
        receipt.data.rfcMessageId !== fact.rfcMessageId ||
        receipt.data.googleSubject !== fact.binding.googleSubject ||
        receipt.data.rawSha256 !== fact.rawSha256 ||
        receipt.data.providerCreatedAt !== fact.providerCreatedAt.toISOString()
      )
        return held("confirmation_conflict");
      return {
        status: "ready",
        value: {
          reservationId: fact.reservationId,
          submissionMarkedAt: row.submittedAt,
          anchor: {
            basis: "gmail_fss_sent_observed",
            observedAt: row.observedAt,
            observationGrantEpoch: receipt.data.observationGrantEpoch,
          },
          coverageOrigin: { kind: "unknown" },
          campaign: snapshot.data.campaign,
        },
      };
    }
    if (campaign && member && !member.first && message.step === 0) {
      const [existing] = await tx<{ found: boolean }[]>`
        select exists(select 1 from growth.email_messages where sequence_enrollment_id=${row.sequenceId} and direction='outbound' and step_number in (1,2)) as found`;
      if (!existing || existing.found) return held("followup_conflict");
      const reports = await tx<
        { memberId: string | null; anchorId: string | null }[]
      >`
        select membership_id as "memberId",anchor_reservation_id as "anchorId" from growth.outreach_jobs
        where campaign_id=${campaign.campaignId} and job_type='monthly_report' limit 2 for update`;
      if (
        reports.length > 1 ||
        reports.some(
          (report) => report.memberId !== null || report.anchorId === null,
        )
      )
        return held("report_job_conflict");
    }
    const receipt = {
      basis: "gmail_fss_sent_observed",
      googleSubject: fact.binding.googleSubject,
      observationGrantEpoch: fact.binding.grantEpoch,
      providerMessageId: fact.providerMessageId,
      providerThreadId: fact.providerThreadId,
      rfcMessageId: fact.rfcMessageId,
      rawSha256: fact.rawSha256,
      observedFrom: fact.observedFrom.toISOString(),
      observedUntil: fact.observedUntil.toISOString(),
      providerCreatedAt: fact.providerCreatedAt.toISOString(),
      possibleInvocationFrom: null,
    };
    await tx`update growth.outreach_reservations set status='accepted',provider_message_id=${fact.providerMessageId},provider_thread_id=${fact.providerThreadId},confirmation_receipt=${tx.json(receipt)},confirmation_observed_at=${fact.observedUntil} where id=${fact.reservationId}`;
    await tx`update growth.email_messages set provider_message_id=${fact.providerMessageId},provider_thread_id=${fact.providerThreadId} where id=${row.messageId}`;
    await tx`update growth.sequence_enrollments set gmail_thread_id=${fact.providerThreadId} where id=${row.sequenceId}`;
    if (campaign && member && !member.first && message.step === 0) {
      const [currentPolicy] = await tx<
        { status: string; policy: unknown; newer: boolean }[]
      >`
        select c.status,c.policy,exists(select 1 from growth.campaigns newer where newer.id=c.id and newer.version>c.version) as newer
        from growth.campaigns c where c.id=${campaign.campaignId} and c.version=${campaign.policyVersion} for share`;
      const parsedPolicy = campaignPolicyDefinitionSchema.safeParse(
        currentPolicy?.policy,
      );
      const policyReady =
        currentPolicy?.status === "approved" &&
        !currentPolicy.newer &&
        parsedPolicy.success &&
        parsedPolicy.data.expiresAt !== null &&
        parsedPolicy.data.expiresAt > clock.now;
      await freezeCampaignConfirmation(tx, {
        campaign,
        memberStatus: member.status,
        sequenceStatus: message.sequenceStatus,
        policyReady,
        prospectId: message.prospectId,
        contactId: message.contactId,
        sequenceId: row.sequenceId,
        reservationId: fact.reservationId,
        observedUntil: fact.observedUntil,
      });
    }
    if (campaign) {
      const event = fact.reservationId;
      await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${event},${campaign.campaignId},${campaign.policyVersion},${campaign.membershipId},'gmail_sent_observed')`;
      await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${event})`;
    }
    await appendAuditEvent(tx, {
      correlationId: fact.reservationId,
      actorType: "system",
      actorId: "gmail-confirmation",
      action: "outreach_reservation.gmail_sent_observed",
      entityType: "outreach_reservation",
      entityId: fact.reservationId,
    });
    return {
      status: "ready",
      value: {
        reservationId: fact.reservationId,
        submissionMarkedAt: row.submittedAt,
        anchor: {
          basis: "gmail_fss_sent_observed",
          observedAt: fact.observedUntil,
          observationGrantEpoch: fact.binding.grantEpoch,
        },
        coverageOrigin: { kind: "unknown" },
        campaign,
      },
    };
  });
}

export function createGmailConfirmation(
  db: GrowthDb,
  resolve: () => Promise<BoundReader>,
) {
  return async (
    reservationId: string,
  ): Promise<ReservationOutcome<GmailConfirmationResult>> => {
    const observation = await observeGmailConfirmation(
      db,
      resolve,
      reservationId,
    );
    if (observation.status === "held") return observation;
    return persistGmailConfirmation(db, observation.value);
  };
}

export function createLiveGmailConfirmation(
  db: GrowthDb,
  config: LiveGmailClientConfig,
) {
  return createGmailConfirmation(db, () =>
    createBoundLiveGmailClient(db, config),
  );
}
