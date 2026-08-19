import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  SequenceResumeRepository,
  SequenceResumeTransaction,
} from "./resume";

function createTransaction(
  transaction: GrowthTransaction,
): SequenceResumeTransaction {
  return {
    async lockEnrollment(sequenceId) {
      const rows = await transaction<Array<{ id: string; status: string }>>`
        select id, status
        from growth.sequence_enrollments
        where id = ${sequenceId}
        for update
      `;
      return rows[0] ?? null;
    },

    async applyResume(sequenceId) {
      await transaction`
        update growth.sequence_enrollments
        set status = 'active',
            stopped_at = null,
            stop_reason = null,
            updated_at = now()
        where id = ${sequenceId}
      `;
    },

    appendResumeAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "sequence.resumed",
        entityType: "sequence_enrollment",
        entityId: input.sequenceId,
      });
    },
  };
}

export const postgresSequenceResumeRepository: SequenceResumeRepository = {
  withTransaction(db, operation) {
    return withGrowthTransaction(db, (transaction) =>
      operation(createTransaction(transaction)),
    );
  },
};
