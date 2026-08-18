import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type { SequenceStopRepository, SequenceStopTransaction } from "./stop";

function createTransaction(
  transaction: GrowthTransaction,
): SequenceStopTransaction {
  return {
    async lockEnrollment(sequenceId) {
      const rows = await transaction<
        Array<{
          id: string;
          status: string;
          normalisedEmail: string;
          businessId: string;
        }>
      >`
        select
          se.id,
          se.status,
          c.normalised_email as "normalisedEmail",
          p.business_id as "businessId"
        from growth.sequence_enrollments se
        inner join growth.prospects p on p.id = se.prospect_id
        inner join growth.contacts c on c.id = se.contact_id
        where se.id = ${sequenceId}
        for update of se
      `;
      return rows[0] ?? null;
    },

    async cancelPendingMessages(sequenceId) {
      const rows = await transaction<Array<{ id: string }>>`
        update growth.email_messages
        set status = 'cancelled',
            lease_token = null,
            lease_expires_at = null,
            last_error_code = 'sequence_stopped',
            updated_at = now()
        where sequence_enrollment_id = ${sequenceId}
          and status in ('queued', 'retry')
        returning id
      `;
      return { cancelledCount: rows.length };
    },

    async applyStop(input) {
      await transaction`
        update growth.sequence_enrollments
        set status = ${input.status},
            stopped_at = ${input.stoppedAt},
            stop_reason = ${input.reason},
            updated_at = now()
        where id = ${input.sequenceId}
      `;
    },

    async insertDoNotContactSuppression(input) {
      await transaction`
        insert into growth.suppressions (
          normalised_email, business_id, reason, source, created_by
        ) values (
          ${input.normalisedEmail}, ${input.businessId}, ${input.reason}, ${input.source}, ${input.createdBy}
        )
        on conflict (normalised_email) do nothing
      `;
    },

    appendStopAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: `sequence.stopped.${input.reason}`,
        entityType: "sequence_enrollment",
        entityId: input.sequenceId,
      });
    },
  };
}

export const postgresSequenceStopRepository: SequenceStopRepository = {
  withTransaction(db, operation) {
    return withGrowthTransaction(db, (transaction) =>
      operation(createTransaction(transaction)),
    );
  },
};
