import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  FirstEmailRedraftRepository,
  FirstEmailRedraftTransaction,
} from "./redraft";

export class FirstEmailRedraftPersistenceError extends Error {
  constructor() {
    super("The first-email redraft request could not be stored.");
    this.name = "FirstEmailRedraftPersistenceError";
  }
}

function createTransaction(
  transaction: GrowthTransaction,
): FirstEmailRedraftTransaction {
  return {
    async lockDraft(draftTaskId) {
      const rows = await transaction<
        Array<{
          id: string;
          prospectId: string;
          researchRunId: string;
          status: string;
          outputSnapshot: unknown;
          completedAt: Date | null;
        }>
      >`
        select
          at.id,
          at.prospect_id as "prospectId",
          at.research_run_id as "researchRunId",
          at.status,
          at.output_snapshot as "outputSnapshot",
          at.completed_at as "completedAt"
        from growth.agent_tasks at
        where at.id = ${draftTaskId}
          and at.task_type = 'first_email_draft'
        for update of at
      `;
      const draft = rows[0];
      if (!draft) return null;

      const enrollmentRows = await transaction<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from growth.sequence_enrollments se
          where se.prospect_id = ${draft.prospectId}
        ) as exists
      `;
      return {
        ...draft,
        hasEnrollment: enrollmentRows[0]?.exists === true,
      };
    },

    async createRedraftTask(input) {
      const idempotencyKey = `redraft:${input.draftTaskId}`;
      const inputSnapshot = {
        schemaVersion: "1.0",
        redraftOfDraftTaskId: input.draftTaskId,
        reason: input.reason,
      };

      const inserted = await transaction<Array<{ id: string }>>`
        insert into growth.agent_tasks (
          research_run_id, prospect_id, task_type, status,
          input_snapshot, idempotency_key
        ) values (
          ${input.researchRunId}, ${input.prospectId}, 'first_email_redraft', 'pending',
          ${transaction.json(inputSnapshot)}, ${idempotencyKey}
        )
        on conflict (idempotency_key) do nothing
        returning id
      `;
      const insertedId = inserted[0]?.id;
      if (insertedId) return { redraftTaskId: insertedId };

      const existing = await transaction<Array<{ id: string }>>`
        select id from growth.agent_tasks where idempotency_key = ${idempotencyKey}
      `;
      const existingId = existing[0]?.id;
      if (!existingId) {
        throw new FirstEmailRedraftPersistenceError();
      }
      return { redraftTaskId: existingId };
    },

    appendRedraftAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "first_email.redraft_requested",
        entityType: "agent_task",
        entityId: input.draftTaskId,
      });
    },
  };
}

export const postgresFirstEmailRedraftRepository: FirstEmailRedraftRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
