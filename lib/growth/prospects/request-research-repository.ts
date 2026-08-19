import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  ProspectResearchRequestRepository,
  ProspectResearchRequestTransaction,
} from "./request-research";

export class ProspectResearchRequestPersistenceError extends Error {
  constructor() {
    super("The prospect research request could not be stored.");
    this.name = "ProspectResearchRequestPersistenceError";
  }
}

function createTransaction(
  transaction: GrowthTransaction,
): ProspectResearchRequestTransaction {
  return {
    async lockProspect(prospectId) {
      const rows = await transaction<
        Array<{
          id: string;
          status: string;
          version: number;
          researchRunId: string | null;
        }>
      >`
        select
          p.id,
          p.status,
          p.version,
          p.research_run_id as "researchRunId"
        from growth.prospects p
        where p.id = ${prospectId}
        for update of p
      `;
      return rows[0] ?? null;
    },

    async createResearchRefreshTask(input) {
      const inputSnapshot = {
        schemaVersion: "1.0",
        requestedForProspectId: input.prospectId,
      };

      const inserted = await transaction<Array<{ id: string }>>`
        insert into growth.agent_tasks (
          research_run_id, prospect_id, task_type, status,
          input_snapshot, idempotency_key
        ) values (
          ${input.researchRunId}, ${input.prospectId}, 'research_refresh', 'pending',
          ${transaction.json(inputSnapshot)}, ${input.idempotencyKey}
        )
        on conflict (idempotency_key) do nothing
        returning id
      `;
      const insertedId = inserted[0]?.id;
      if (insertedId) return { agentTaskId: insertedId };

      const existing = await transaction<Array<{ id: string }>>`
        select id from growth.agent_tasks where idempotency_key = ${input.idempotencyKey}
      `;
      const existingId = existing[0]?.id;
      if (!existingId) {
        throw new ProspectResearchRequestPersistenceError();
      }
      return { agentTaskId: existingId };
    },

    async markResearchRequested(input) {
      await transaction`
        update growth.prospects
        set next_action = 'Awaiting refreshed research',
            next_action_due_at = null,
            version = version + 1,
            updated_at = now()
        where id = ${input.prospectId}
      `;
    },

    appendResearchRequestAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "prospect.research_requested",
        entityType: "prospect",
        entityId: input.prospectId,
      });
    },
  };
}

export const postgresProspectResearchRequestRepository: ProspectResearchRequestRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
