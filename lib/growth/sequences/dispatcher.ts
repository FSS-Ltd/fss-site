import { randomUUID } from "node:crypto";
import type { GrowthDb } from "../db/types";
import type { BoundGmailClient } from "../integrations/gmail/live-client";
import type { ReservedOutreach } from "../campaigns/reservation-repository";
import type { ReservationOutcome } from "../campaigns/reservation-shared";
import { reserveOutreachAttempt } from "../campaigns/reservation-repository";
import { submitReservedOutreach } from "../campaigns/direct-submission";
import { createGmailConfirmation } from "../campaigns/gmail-confirmation";
import { refreshGmailUsage } from "../integrations/gmail/usage-service";
import type { SequenceDispatchRepository } from "./dispatcher-repository";
import {
  AUTOMATED_FOLLOW_UP_LABELS,
  type FollowUpLabel,
  scheduleFollowUps,
} from "./schedule";

const LEASE_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_MAX_MESSAGES_PER_RUN = 25;
const MESSAGE_HOLDS = new Set([
  "attempt_conflict",
  "attempt_unresolved",
  "claim_history_unproven",
  "claim_provenance_unknown",
  "claimed_content_changed",
  "controlled_variant_unproven",
  "first_message_already_threaded",
  "identity_changed",
  "identity_unknown",
  "lease_invalid",
  "legacy_approval_unbound",
  "legacy_attempt_unreconciled",
  "membership_ambiguous",
  "message_unprepared",
  "outreach_excluded",
  "outside_window",
  "permission_invalid",
  "policy_not_authorized",
  "research_permission_changed",
  "reply_coverage_unknown",
  "rfc_message_id_changed",
  "thread_references_overflow",
  "thread_unknown",
  "verification_required",
]);
const STEP_BY_FOLLOW_UP_LABEL: Record<FollowUpLabel, number> = {
  day_5: 1,
  day_11: 2,
  day_14: 3,
};

export type DispatchSummary = {
  claimed: number;
  accepted: number;
  confirmed: number;
  held: number;
  notInvoked: number;
  uncertain: number;
};

export function scheduledFollowUpsForFirstSend(
  sequenceEnrollmentId: string,
  observedAt: Date,
) {
  const scheduled = scheduleFollowUps(observedAt);
  return AUTOMATED_FOLLOW_UP_LABELS.map((label) => {
    const stepNumber = STEP_BY_FOLLOW_UP_LABEL[label];
    return {
      stepNumber,
      scheduledFor: scheduled[label],
      idempotencyKey: `follow_up:${stepNumber}:${sequenceEnrollmentId}`,
    };
  });
}

type SubmissionResult =
  | { status: "accepted" }
  | { status: "not_invoked" | "uncertain" | "held"; reason: string };
type Dependencies = {
  repository: SequenceDispatchRepository;
  bound: BoundGmailClient;
  refreshUsage: (
    db: GrowthDb,
    bound: BoundGmailClient,
  ) => Promise<{ status: "complete" } | { status: "held"; reason: string }>;
  reserve: (
    db: GrowthDb,
    input: {
      messageId: string;
      leaseToken: string;
      attemptKey: string;
      coverageId?: string;
    },
  ) => Promise<ReservationOutcome<ReservedOutreach>>;
  submit: (
    db: GrowthDb,
    input: {
      reservationId: string;
      leaseToken: string;
      fence: number;
      fingerprint: string;
      coverageId?: string;
      bound: BoundGmailClient;
    },
  ) => Promise<SubmissionResult>;
  confirm: (
    db: GrowthDb,
    reservationId: string,
    bound: BoundGmailClient,
  ) => Promise<{ status: "ready" } | { status: "held"; reason: string }>;
  now?: () => Date;
  createLeaseToken?: () => string;
  maxMessagesPerRun?: number;
};

export function createOutreachDispatcher({
  repository,
  bound,
  refreshUsage,
  reserve,
  submit,
  confirm,
  now = () => new Date(),
  createLeaseToken = () => randomUUID(),
  maxMessagesPerRun = DEFAULT_MAX_MESSAGES_PER_RUN,
}: Dependencies) {
  return async function dispatchDueOutreach(
    db: GrowthDb,
    dispatchAt: Date,
    messageId?: string,
    coverageId?: string | null,
  ): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      claimed: 0,
      accepted: 0,
      confirmed: 0,
      held: 0,
      notInvoked: 0,
      uncertain: 0,
    };
    const usage = await refreshUsage(db, bound);
    if (!messageId) {
      const pending = await repository.claimPendingConfirmations(
        db,
        bound.binding.connectionId,
      );
      for (const reservationId of pending) {
        try {
          const confirmation = await confirm(db, reservationId, bound);
          if (confirmation.status === "ready") summary.confirmed += 1;
          else summary.held += 1;
        } catch {
          summary.held += 1;
          return summary;
        }
      }
    }
    if (usage.status === "held") {
      summary.held += 1;
      return summary;
    }
    const examined: string[] = [];
    for (let index = 0; index < maxMessagesPerRun; index += 1) {
      const leaseToken = createLeaseToken();
      const claimed = await repository.claimDueMessage(db, {
        now: dispatchAt,
        leaseToken,
        leaseExpiresAt: new Date(now().getTime() + LEASE_DURATION_MS),
        excludeMessageIds: examined,
        ...(messageId ? { messageId } : {}),
      });
      if (!claimed) break;
      examined.push(claimed.id);
      summary.claimed += 1;
      const prepared = await repository.prepareLegacyMessage(db, {
        messageId: claimed.id,
        leaseToken,
        claimed,
      });
      if (prepared.status === "held") {
        summary.held += 1;
        if (messageId || !MESSAGE_HOLDS.has(prepared.reason)) break;
        continue;
      }
      const reservation = await reserve(db, {
        messageId: claimed.id,
        leaseToken,
        attemptKey: `outreach:${claimed.id}:${leaseToken}`,
        ...(coverageId ? { coverageId } : {}),
      });
      if (reservation.status === "held") {
        summary.held += 1;
        if (messageId || !MESSAGE_HOLDS.has(reservation.reason)) break;
        continue;
      }
      const { reservationId, fence, preparation } = reservation.value;
      let result: SubmissionResult;
      try {
        result = await submit(db, {
          reservationId,
          leaseToken,
          fence,
          fingerprint: preparation.fingerprint,
          ...(coverageId ? { coverageId } : {}),
          bound,
        });
      } catch {
        summary.uncertain += 1;
        break;
      }
      if (result.status !== "accepted") {
        if (result.status === "not_invoked") summary.notInvoked += 1;
        else if (result.status === "uncertain") summary.uncertain += 1;
        else summary.held += 1;
        if (
          result.status === "held" &&
          !messageId &&
          MESSAGE_HOLDS.has(result.reason)
        )
          continue;
        break;
      }
      summary.accepted += 1;
      let confirmation: Awaited<ReturnType<typeof confirm>>;
      try {
        confirmation = await confirm(db, reservationId, bound);
      } catch {
        summary.held += 1;
        break;
      }
      if (confirmation.status === "ready") summary.confirmed += 1;
      else {
        summary.held += 1;
      }
      if (messageId) break;
    }
    return summary;
  };
}

export function createLiveOutreachDispatcher(input: {
  repository: SequenceDispatchRepository;
  bound: BoundGmailClient;
  founderEmail: string;
  maxMessagesPerRun?: number;
}) {
  return createOutreachDispatcher({
    repository: input.repository,
    bound: input.bound,
    maxMessagesPerRun: input.maxMessagesPerRun,
    refreshUsage: (db, bound) =>
      refreshGmailUsage(db, { ...bound, subjectEmail: input.founderEmail }),
    reserve: reserveOutreachAttempt,
    submit: submitReservedOutreach,
    confirm: (db, reservationId, bound) =>
      createGmailConfirmation(db, async () => bound)(reservationId),
  });
}
