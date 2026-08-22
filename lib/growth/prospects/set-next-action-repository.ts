import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  SetNextActionRepository,
  SetNextActionTransaction,
} from "./set-next-action";

function createTransaction(
  transaction: GrowthTransaction,
): SetNextActionTransaction {
  return {
    async lockProspect(prospectId) {
      const rows = await transaction<
        Array<{
          id: string;
          status: string;
          version: number;
          nextAction: string | null;
          nextActionDueAt: string | null;
        }>
      >`
        select id, status, version,
               next_action as "nextAction",
               next_action_due_at as "nextActionDueAt"
        from growth.prospects
        where id = ${prospectId}
        for update
      `;
      return rows[0] ?? null;
    },

    async applyNextAction(input) {
      await transaction`
        update growth.prospects
        set next_action = ${input.nextAction},
            next_action_due_at = ${input.nextActionDueAt},
            version = version + 1,
            updated_at = now()
        where id = ${input.prospectId}
      `;
    },

    appendNextActionAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "prospect.next_action_set",
        entityType: "prospect",
        entityId: input.prospectId,
      });
    },
  };
}

export const postgresSetNextActionRepository: SetNextActionRepository = {
  withTransaction(db, operation) {
    return withGrowthTransaction(db, (transaction) =>
      operation(createTransaction(transaction)),
    );
  },
};
