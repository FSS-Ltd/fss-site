import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { postgresSequenceResumeRepository } from "./resume-repository";

const SEQUENCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export type LockedEnrollment = {
  id: string;
  status: string;
};

export type AppendResumeAuditInput = {
  correlationId: string;
  actorId: string;
  sequenceId: string;
};

export interface SequenceResumeTransaction {
  lockEnrollment(sequenceId: string): Promise<LockedEnrollment | null>;
  applyResume(sequenceId: string): Promise<void>;
  appendResumeAudit(input: AppendResumeAuditInput): Promise<void>;
}

export interface SequenceResumeRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: SequenceResumeTransaction) => Promise<T>,
  ): Promise<T>;
}

export type ResumeSequenceInput = {
  sequenceId: string;
  founder: FounderSession;
  correlationId: string;
};

export type ResumedSequence = {
  sequenceId: string;
  status: string;
  alreadyApplied: boolean;
};

export type SequenceResumeErrorCode = "not_found" | "not_resumable";

export class SequenceResumeError extends Error {
  constructor(readonly code: SequenceResumeErrorCode) {
    super("The sequence could not be resumed.");
    this.name = "SequenceResumeError";
  }
}

function validateRequest(input: ResumeSequenceInput): void {
  if (
    !SEQUENCE_ID_PATTERN.test(input.sequenceId) ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId)
  ) {
    throw new TypeError("Sequence resume request is invalid.");
  }
}

type SequenceResumerDependencies = {
  repository: SequenceResumeRepository;
};

export function createSequenceResumer({
  repository,
}: SequenceResumerDependencies) {
  return async function resumeSequence(
    db: GrowthDb,
    input: ResumeSequenceInput,
  ): Promise<ResumedSequence> {
    validateRequest(input);

    return repository.withTransaction(db, async (transaction) => {
      const enrollment = await transaction.lockEnrollment(input.sequenceId);
      if (!enrollment) throw new SequenceResumeError("not_found");

      if (enrollment.status === "active") {
        return {
          sequenceId: input.sequenceId,
          status: enrollment.status,
          alreadyApplied: true,
        };
      }
      if (enrollment.status !== "paused") {
        throw new SequenceResumeError("not_resumable");
      }

      await transaction.applyResume(input.sequenceId);
      await transaction.appendResumeAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        sequenceId: input.sequenceId,
      });

      return {
        sequenceId: input.sequenceId,
        status: "active",
        alreadyApplied: false,
      };
    });
  };
}

export const resumeSequence = createSequenceResumer({
  repository: postgresSequenceResumeRepository,
});
