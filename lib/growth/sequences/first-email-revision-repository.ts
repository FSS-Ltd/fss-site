import type postgres from "postgres";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  FirstEmailRevisionRepository,
  FirstEmailRevisionTransaction,
} from "./first-email-revisions";

export class FirstEmailRevisionPersistenceError extends Error {
  constructor() {
    super("The first-email revision could not be stored.");
    this.name = "FirstEmailRevisionPersistenceError";
  }
}

function toJsonValue(value: unknown): postgres.JSONValue {
  // A successful JSON round trip guarantees the driver receives JSON-safe data.
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function createTransaction(
  transaction: GrowthTransaction,
): FirstEmailRevisionTransaction {
  return {
    async lockDraft(draftTaskId) {
      const rows = await transaction<
        Array<{
          id: string;
          prospectId: string;
          status: string;
          outputSnapshot: unknown;
          completedAt: Date | null;
        }>
      >`
        select
          at.id,
          at.prospect_id as "prospectId",
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

    async saveDraftRevision(input) {
      const rows = await transaction<Array<{ id: string }>>`
        update growth.agent_tasks
        set output_snapshot = ${transaction.json(
          toJsonValue(input.outputSnapshot),
        )},
            updated_at = now()
        where id = ${input.draftTaskId}
          and task_type = 'first_email_draft'
        returning id
      `;
      if (!rows[0]) {
        throw new FirstEmailRevisionPersistenceError();
      }
    },

    appendRevisionAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "email_draft.revised",
        entityType: "agent_task",
        entityId: input.draftTaskId,
      });
    },
  };
}

export const postgresFirstEmailRevisionRepository: FirstEmailRevisionRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
