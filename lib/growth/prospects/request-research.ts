import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { postgresProspectResearchRequestRepository } from "./request-research-repository";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

const TERMINAL_STATUSES = new Set(["won", "lost", "rejected", "suppressed"]);

export type LockedResearchableProspect = {
  id: string;
  status: string;
  version: number;
  researchRunId: string | null;
};

export type CreateResearchRefreshTaskInput = {
  prospectId: string;
  researchRunId: string;
  idempotencyKey: string;
};

export type ApplyResearchRequestedInput = {
  prospectId: string;
};

export type AppendResearchRequestAuditInput = {
  correlationId: string;
  actorId: string;
  prospectId: string;
  agentTaskId: string;
};

export interface ProspectResearchRequestTransaction {
  lockProspect(prospectId: string): Promise<LockedResearchableProspect | null>;
  createResearchRefreshTask(
    input: CreateResearchRefreshTaskInput,
  ): Promise<{ agentTaskId: string }>;
  markResearchRequested(input: ApplyResearchRequestedInput): Promise<void>;
  appendResearchRequestAudit(
    input: AppendResearchRequestAuditInput,
  ): Promise<void>;
}

export interface ProspectResearchRequestRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: ProspectResearchRequestTransaction) => Promise<T>,
  ): Promise<T>;
}

export type RequestProspectResearchInput = {
  prospectId: string;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
};

export type ProspectResearchRequest = {
  prospectId: string;
  agentTaskId: string;
};

export type ProspectResearchRequestErrorCode =
  | "not_found"
  | "version_conflict"
  | "no_research_run"
  | "already_terminal";

export class ProspectResearchRequestError extends Error {
  constructor(readonly code: ProspectResearchRequestErrorCode) {
    super("A research refresh could not be requested for this prospect.");
    this.name = "ProspectResearchRequestError";
  }
}

function validateRequest(input: RequestProspectResearchInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1 ||
    !input.correlationId.trim() ||
    input.correlationId.length > 200 ||
    !FOUNDER_ACTOR_ID_PATTERN.test(input.founder.actorId)
  ) {
    throw new TypeError("Prospect research request is invalid.");
  }
}

type ProspectResearchRequesterDependencies = {
  repository: ProspectResearchRequestRepository;
};

export function createProspectResearchRequester({
  repository,
}: ProspectResearchRequesterDependencies) {
  return async function requestProspectResearch(
    db: GrowthDb,
    input: RequestProspectResearchInput,
  ): Promise<ProspectResearchRequest> {
    validateRequest(input);

    return repository.withTransaction(db, async (transaction) => {
      const prospect = await transaction.lockProspect(input.prospectId);
      if (!prospect) throw new ProspectResearchRequestError("not_found");
      if (prospect.version !== input.expectedVersion) {
        throw new ProspectResearchRequestError("version_conflict");
      }
      if (TERMINAL_STATUSES.has(prospect.status)) {
        throw new ProspectResearchRequestError("already_terminal");
      }
      if (!prospect.researchRunId) {
        throw new ProspectResearchRequestError("no_research_run");
      }

      const idempotencyKey = `research_refresh:${input.prospectId}:v${input.expectedVersion}`;
      const { agentTaskId } = await transaction.createResearchRefreshTask({
        prospectId: input.prospectId,
        researchRunId: prospect.researchRunId,
        idempotencyKey,
      });

      await transaction.markResearchRequested({ prospectId: input.prospectId });

      await transaction.appendResearchRequestAudit({
        correlationId: input.correlationId,
        actorId: input.founder.actorId,
        prospectId: input.prospectId,
        agentTaskId,
      });

      return { prospectId: input.prospectId, agentTaskId };
    });
  };
}

export const requestProspectResearch = createProspectResearchRequester({
  repository: postgresProspectResearchRequestRepository,
});
