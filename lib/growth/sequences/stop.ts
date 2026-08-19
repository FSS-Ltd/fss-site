import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { postgresSequenceStopRepository } from "./stop-repository";

const SEQUENCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export const STOP_REASONS = [
  "pause",
  "started_talks",
  "rejected",
  "do_not_contact",
  "reply",
  "bounce",
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

const STATUS_BY_REASON: Record<StopReason, string> = {
  pause: "paused",
  started_talks: "stopped_started_talks",
  rejected: "stopped_rejected",
  do_not_contact: "stopped_opt_out",
  reply: "stopped_reply",
  bounce: "stopped_bounce",
};

const TERMINAL_STATUSES = new Set([
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
]);

const SUPPRESSING_REASONS = new Set<StopReason>(["do_not_contact", "bounce"]);

export type GmailSyncActor = { type: "gmail_sync"; id: string };
export type ResendWebhookActor = { type: "resend_webhook"; id: string };

export type StopSequenceInput = {
  sequenceId: string;
  reason: StopReason;
  actor: FounderSession | GmailSyncActor | ResendWebhookActor;
  correlationId: string;
};

export type StoppedSequence = {
  sequenceId: string;
  status: string;
  alreadyApplied: boolean;
};

export type LockedEnrollment = {
  id: string;
  status: string;
  normalisedEmail: string;
  businessId: string;
};

export type CancelPendingMessagesResult = { cancelledCount: number };

export type ApplyStopInput = {
  sequenceId: string;
  status: string;
  reason: StopReason;
  stoppedAt: Date;
};

export type InsertDoNotContactSuppressionInput = {
  normalisedEmail: string;
  businessId: string;
  reason: string;
  source: string;
  createdBy: string;
};

export type AppendStopAuditInput = {
  correlationId: string;
  actorType: "founder" | "cron" | "provider";
  actorId: string;
  sequenceId: string;
  reason: StopReason;
};

export interface SequenceStopTransaction {
  lockEnrollment(sequenceId: string): Promise<LockedEnrollment | null>;
  cancelPendingMessages(
    sequenceId: string,
  ): Promise<CancelPendingMessagesResult>;
  applyStop(input: ApplyStopInput): Promise<void>;
  insertDoNotContactSuppression(
    input: InsertDoNotContactSuppressionInput,
  ): Promise<void>;
  appendStopAudit(input: AppendStopAuditInput): Promise<void>;
}

export interface SequenceStopRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: SequenceStopTransaction) => Promise<T>,
  ): Promise<T>;
}

export type SequenceStopErrorCode = "not_found" | "already_stopped";

export class SequenceStopError extends Error {
  constructor(readonly code: SequenceStopErrorCode) {
    super("The sequence could not be stopped.");
    this.name = "SequenceStopError";
  }
}

function resolveActor(actor: StopSequenceInput["actor"]): {
  actorType: "founder" | "cron" | "provider";
  actorId: string;
} {
  if ("type" in actor && actor.type === "gmail_sync") {
    return { actorType: "cron", actorId: actor.id };
  }
  if ("type" in actor && actor.type === "resend_webhook") {
    return { actorType: "provider", actorId: actor.id };
  }
  return { actorType: "founder", actorId: (actor as FounderSession).actorId };
}

function validateRequest(input: StopSequenceInput): void {
  const { actorId } = resolveActor(input.actor);
  if (
    !SEQUENCE_ID_PATTERN.test(input.sequenceId) ||
    !STOP_REASONS.includes(input.reason) ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    ("email" in input.actor && !FOUNDER_ACTOR_ID_PATTERN.test(actorId)) ||
    (!("email" in input.actor) && !actorId.trim())
  ) {
    throw new TypeError("Sequence stop request is invalid.");
  }
}

type SequenceStopperDependencies = {
  repository: SequenceStopRepository;
  now?: () => Date;
};

export function createSequenceStopper({
  repository,
  now = () => new Date(),
}: SequenceStopperDependencies) {
  return async function stopSequence(
    db: GrowthDb,
    input: StopSequenceInput,
  ): Promise<StoppedSequence> {
    validateRequest(input);
    const { actorType, actorId } = resolveActor(input.actor);
    const targetStatus = STATUS_BY_REASON[input.reason];

    return repository.withTransaction(db, async (transaction) => {
      const enrollment = await transaction.lockEnrollment(input.sequenceId);
      if (!enrollment) throw new SequenceStopError("not_found");

      if (enrollment.status === targetStatus) {
        return {
          sequenceId: input.sequenceId,
          status: enrollment.status,
          alreadyApplied: true,
        };
      }
      if (TERMINAL_STATUSES.has(enrollment.status)) {
        throw new SequenceStopError("already_stopped");
      }

      await transaction.cancelPendingMessages(input.sequenceId);
      await transaction.applyStop({
        sequenceId: input.sequenceId,
        status: targetStatus,
        reason: input.reason,
        stoppedAt: now(),
      });

      if (SUPPRESSING_REASONS.has(input.reason)) {
        await transaction.insertDoNotContactSuppression({
          normalisedEmail: enrollment.normalisedEmail,
          businessId: enrollment.businessId,
          reason: input.reason,
          source: actorType === "founder" ? "founder" : actorType === "provider" ? "resend_webhook" : "gmail_sync",
          createdBy: actorId,
        });
      }

      await transaction.appendStopAudit({
        correlationId: input.correlationId,
        actorType,
        actorId,
        sequenceId: input.sequenceId,
        reason: input.reason,
      });

      return {
        sequenceId: input.sequenceId,
        status: targetStatus,
        alreadyApplied: false,
      };
    });
  };
}

export const stopSequence = createSequenceStopper({
  repository: postgresSequenceStopRepository,
});
