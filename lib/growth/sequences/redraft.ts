import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  InvalidStoredFirstEmailDraftError,
  parseStoredFirstEmailDraft,
} from "./first-email-draft-snapshot";
import { postgresFirstEmailRedraftRepository } from "./redraft-repository";

const DRAFT_TASK_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;
const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1000;

export type LockedRedraftDraft = {
  id: string;
  prospectId: string;
  researchRunId: string;
  status: string;
  outputSnapshot: unknown;
  completedAt: Date | null;
  hasEnrollment: boolean;
};

export type CreateRedraftTaskInput = {
  researchRunId: string;
  prospectId: string;
  draftTaskId: string;
  reason: string;
};

export type AppendRedraftAuditInput = {
  correlationId: string;
  actorId: string;
  draftTaskId: string;
};

export interface FirstEmailRedraftTransaction {
  lockDraft(draftTaskId: string): Promise<LockedRedraftDraft | null>;
  createRedraftTask(
    input: CreateRedraftTaskInput,
  ): Promise<{ redraftTaskId: string }>;
  appendRedraftAudit(input: AppendRedraftAuditInput): Promise<void>;
}

export interface FirstEmailRedraftRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: FirstEmailRedraftTransaction) => Promise<T>,
  ): Promise<T>;
}

export type RequestFirstEmailRedraftInput = {
  draftTaskId: string;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
  reason: string;
};

export type FirstEmailRedraftRequest = {
  draftTaskId: string;
  redraftTaskId: string;
};

export type FirstEmailRedraftErrorCode =
  | "not_found"
  | "not_redraftable"
  | "version_conflict"
  | "invalid_stored_draft";

export class FirstEmailRedraftError extends Error {
  constructor(readonly code: FirstEmailRedraftErrorCode) {
    super("The first-email draft could not be sent back for redraft.");
    this.name = "FirstEmailRedraftError";
  }
}

function validateRequest(input: RequestFirstEmailRedraftInput): void {
  const reason = input.reason.trim();
  if (
    !DRAFT_TASK_ID_PATTERN.test(input.draftTaskId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId) ||
    reason.length < MIN_REASON_LENGTH ||
    reason.length > MAX_REASON_LENGTH
  ) {
    throw new TypeError("First-email redraft request is invalid.");
  }
}

type FirstEmailRedrafterDependencies = {
  repository: FirstEmailRedraftRepository;
};

export function createFirstEmailRedrafter({
  repository,
}: FirstEmailRedrafterDependencies) {
  return async function requestRedraft(
    db: GrowthDb,
    input: RequestFirstEmailRedraftInput,
  ): Promise<FirstEmailRedraftRequest> {
    validateRequest(input);
    const reason = input.reason.trim();

    return repository.withTransaction(db, async (transaction) => {
      const draft = await transaction.lockDraft(input.draftTaskId);
      if (!draft) throw new FirstEmailRedraftError("not_found");

      let stored;
      try {
        stored = parseStoredFirstEmailDraft(draft);
      } catch (error) {
        if (error instanceof InvalidStoredFirstEmailDraftError) {
          throw new FirstEmailRedraftError("invalid_stored_draft");
        }
        throw error;
      }

      if (
        draft.status !== "completed" ||
        stored.reviewState !== "draft" ||
        draft.hasEnrollment
      ) {
        throw new FirstEmailRedraftError("not_redraftable");
      }
      if (stored.version !== input.expectedVersion) {
        throw new FirstEmailRedraftError("version_conflict");
      }

      const { redraftTaskId } = await transaction.createRedraftTask({
        researchRunId: draft.researchRunId,
        prospectId: draft.prospectId,
        draftTaskId: draft.id,
        reason,
      });
      await transaction.appendRedraftAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        draftTaskId: draft.id,
      });

      return { draftTaskId: draft.id, redraftTaskId };
    });
  };
}

export const requestFirstEmailRedraft = createFirstEmailRedrafter({
  repository: postgresFirstEmailRedraftRepository,
});
