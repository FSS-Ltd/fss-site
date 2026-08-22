import { z } from "zod";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { postgresSetNextActionRepository } from "./set-next-action-repository";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

// A single dated next step, not a generic notes system: one text field and
// one due date, always overwriting whatever was there before.
export const setNextActionBodySchema = z.object({
  expectedVersion: z.number().int().min(1),
  nextAction: z.string().trim().min(1).max(300),
  nextActionDueAt: z.iso.datetime({ offset: true }),
});

export type SetNextActionBody = z.infer<typeof setNextActionBodySchema>;

export type LockedNextActionProspect = {
  id: string;
  status: string;
  version: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type ApplyNextActionInput = {
  prospectId: string;
  nextAction: string;
  nextActionDueAt: Date;
};

export type AppendNextActionAuditInput = {
  correlationId: string;
  actorId: string;
  prospectId: string;
};

export interface SetNextActionTransaction {
  lockProspect(prospectId: string): Promise<LockedNextActionProspect | null>;
  applyNextAction(input: ApplyNextActionInput): Promise<void>;
  appendNextActionAudit(input: AppendNextActionAuditInput): Promise<void>;
}

export interface SetNextActionRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: SetNextActionTransaction) => Promise<T>,
  ): Promise<T>;
}

export type SetNextActionInput = {
  prospectId: string;
  expectedVersion: number;
  nextAction: string;
  nextActionDueAt: string;
  founder: FounderSession;
  correlationId: string;
};

export type SetNextActionResult = {
  prospectId: string;
  nextAction: string;
  nextActionDueAt: string;
};

export type SetNextActionErrorCode = "not_found" | "version_conflict";

export class SetNextActionError extends Error {
  constructor(readonly code: SetNextActionErrorCode) {
    super("The next action could not be updated.");
    this.name = "SetNextActionError";
  }
}

function validateRequest(input: SetNextActionInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId)
  ) {
    throw new TypeError("Next-action request is invalid.");
  }

  const parsedBody = setNextActionBodySchema.safeParse({
    expectedVersion: input.expectedVersion,
    nextAction: input.nextAction,
    nextActionDueAt: input.nextActionDueAt,
  });
  if (!parsedBody.success) {
    throw new TypeError("Next-action request is invalid.");
  }
}

type SetNextActionerDependencies = {
  repository: SetNextActionRepository;
};

export function createNextActionSetter({ repository }: SetNextActionerDependencies) {
  return async function setNextAction(
    db: GrowthDb,
    input: SetNextActionInput,
  ): Promise<SetNextActionResult> {
    validateRequest(input);

    return repository.withTransaction(db, async (transaction) => {
      const prospect = await transaction.lockProspect(input.prospectId);
      if (!prospect) throw new SetNextActionError("not_found");
      if (prospect.version !== input.expectedVersion) {
        throw new SetNextActionError("version_conflict");
      }

      const dueAt = new Date(input.nextActionDueAt);
      await transaction.applyNextAction({
        prospectId: input.prospectId,
        nextAction: input.nextAction,
        nextActionDueAt: dueAt,
      });

      await transaction.appendNextActionAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        prospectId: input.prospectId,
      });

      return {
        prospectId: input.prospectId,
        nextAction: input.nextAction,
        nextActionDueAt: dueAt.toISOString(),
      };
    });
  };
}

export const setNextAction = createNextActionSetter({
  repository: postgresSetNextActionRepository,
});
