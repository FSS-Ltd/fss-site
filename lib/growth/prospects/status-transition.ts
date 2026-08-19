import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { postgresProspectStatusTransitionRepository } from "./status-transition-repository";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export const PROSPECT_STATUS_TRANSITION_REASONS = [
  "reject",
  "do_not_contact",
  "started_talks",
] as const;
export type ProspectStatusTransitionReason =
  (typeof PROSPECT_STATUS_TRANSITION_REASONS)[number];

const STATUS_BY_REASON: Record<ProspectStatusTransitionReason, string> = {
  reject: "rejected",
  do_not_contact: "suppressed",
  started_talks: "started_talks",
};

const TERMINAL_STATUSES = new Set(["won", "lost", "rejected", "suppressed"]);

const SUPPRESSING_REASONS = new Set<ProspectStatusTransitionReason>([
  "do_not_contact",
]);

export type LockedProspect = {
  id: string;
  status: string;
  version: number;
  normalisedEmail: string | null;
  businessId: string;
};

export type ApplyProspectTransitionInput = {
  prospectId: string;
  status: string;
};

export type InsertDoNotContactSuppressionInput = {
  normalisedEmail: string;
  businessId: string;
  reason: string;
  source: string;
  createdBy: string;
};

export type AppendProspectTransitionAuditInput = {
  correlationId: string;
  actorId: string;
  prospectId: string;
  reason: ProspectStatusTransitionReason;
};

export interface ProspectStatusTransitionTransaction {
  lockProspect(prospectId: string): Promise<LockedProspect | null>;
  applyTransition(input: ApplyProspectTransitionInput): Promise<void>;
  insertDoNotContactSuppression(
    input: InsertDoNotContactSuppressionInput,
  ): Promise<void>;
  appendTransitionAudit(
    input: AppendProspectTransitionAuditInput,
  ): Promise<void>;
}

export interface ProspectStatusTransitionRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: ProspectStatusTransitionTransaction) => Promise<T>,
  ): Promise<T>;
}

export type TransitionProspectStatusInput = {
  prospectId: string;
  reason: ProspectStatusTransitionReason;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
};

export type ProspectStatusTransitionResult = {
  prospectId: string;
  status: string;
  alreadyApplied: boolean;
};

export type ProspectStatusTransitionErrorCode =
  | "not_found"
  | "version_conflict"
  | "already_terminal";

export class ProspectStatusTransitionError extends Error {
  constructor(readonly code: ProspectStatusTransitionErrorCode) {
    super("The prospect status could not be updated.");
    this.name = "ProspectStatusTransitionError";
  }
}

function validateRequest(input: TransitionProspectStatusInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !PROSPECT_STATUS_TRANSITION_REASONS.includes(input.reason) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId)
  ) {
    throw new TypeError("Prospect status transition request is invalid.");
  }
}

type ProspectStatusTransitionerDependencies = {
  repository: ProspectStatusTransitionRepository;
};

export function createProspectStatusTransitioner({
  repository,
}: ProspectStatusTransitionerDependencies) {
  return async function transitionProspectStatus(
    db: GrowthDb,
    input: TransitionProspectStatusInput,
  ): Promise<ProspectStatusTransitionResult> {
    validateRequest(input);
    const targetStatus = STATUS_BY_REASON[input.reason];

    return repository.withTransaction(db, async (transaction) => {
      const prospect = await transaction.lockProspect(input.prospectId);
      if (!prospect) throw new ProspectStatusTransitionError("not_found");

      if (prospect.status === targetStatus) {
        return {
          prospectId: input.prospectId,
          status: prospect.status,
          alreadyApplied: true,
        };
      }
      if (prospect.version !== input.expectedVersion) {
        throw new ProspectStatusTransitionError("version_conflict");
      }
      if (TERMINAL_STATUSES.has(prospect.status)) {
        throw new ProspectStatusTransitionError("already_terminal");
      }

      await transaction.applyTransition({
        prospectId: input.prospectId,
        status: targetStatus,
      });

      if (SUPPRESSING_REASONS.has(input.reason) && prospect.normalisedEmail) {
        await transaction.insertDoNotContactSuppression({
          normalisedEmail: prospect.normalisedEmail,
          businessId: prospect.businessId,
          reason: input.reason,
          source: "founder",
          createdBy: input.founder.actorId,
        });
      }

      await transaction.appendTransitionAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        prospectId: input.prospectId,
        reason: input.reason,
      });

      return {
        prospectId: input.prospectId,
        status: targetStatus,
        alreadyApplied: false,
      };
    });
  };
}

export const transitionProspectStatus = createProspectStatusTransitioner({
  repository: postgresProspectStatusTransitionRepository,
});
