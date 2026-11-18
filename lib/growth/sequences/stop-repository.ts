import { lockCurrentGmailGrant } from "../integrations/gmail/grant";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type { SequenceStopRepository, SequenceStopTransaction } from "./stop";
import {
  findEnrollmentByThread,
  lockGmailThread,
  GmailThreadAttributionChangedError,
} from "./gmail-thread-association";

export function createSequenceStopTransaction(
  transaction: GrowthTransaction,
): SequenceStopTransaction {
  return {
    async lockEnrollment(sequenceId, binding, threadId, attribution = "bound") {
      if (threadId) {
        if (!binding) throw new Error("Gmail thread attribution is invalid.");
        await lockGmailThread(transaction, threadId);
        const match = await findEnrollmentByThread(
          transaction,
          threadId,
          binding,
        );
        const valid =
          attribution === "unbound"
            ? match.kind === "unknown" &&
              match.safeToPause &&
              match.enrollment.id === sequenceId
            : match.kind === "unique" && match.enrollment.id === sequenceId;
        if (!valid) throw new GmailThreadAttributionChangedError();
      }
      const [identity] = await transaction<Array<{ businessId: string }>>`
        select p.business_id as "businessId"
        from growth.sequence_enrollments se
        inner join growth.prospects p on p.id = se.prospect_id
        where se.id = ${sequenceId}
      `;
      if (!identity) return null;
      await transaction`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`}, 0))`;
      if (binding) await lockCurrentGmailGrant(transaction, binding);
      if (threadId && attribution === "bound") {
        if (!binding) throw new Error("Gmail thread attribution is invalid.");
        const [control] = await transaction<Array<{ subject: string }>>`
          select verified_subject as subject from growth.outreach_account_controls where connection_id=${binding.connectionId} for share
        `;
        if (!control || control.subject !== binding.googleSubject)
          throw new Error("Gmail thread attribution is invalid.");
      }
      const rows = await transaction<
        Array<{
          id: string;
          status: string;
          normalisedEmail: string;
          businessId: string;
          gmailThreadId: string | null;
        }>
      >`
        select
          se.id,
          se.status,
          c.normalised_email as "normalisedEmail",
          p.business_id as "businessId",
          se.gmail_thread_id as "gmailThreadId"
        from growth.sequence_enrollments se
        inner join growth.prospects p on p.id = se.prospect_id
        inner join growth.contacts c on c.id = se.contact_id
        where se.id = ${sequenceId}
        for update of se for share of p
      `;
      if (rows[0] && rows[0].businessId !== identity.businessId) {
        throw new Error("Sequence business changed while acquiring lock.");
      }
      if (threadId && binding && rows[0] && attribution === "bound") {
        const [association] = await transaction<Array<{ id: string }>>`
          select id from growth.outreach_reservations where sequence_id=${sequenceId}
            and connection_id=${binding.connectionId} and provider_thread_id=${threadId} limit 1 for share
        `;
        if (rows[0].gmailThreadId !== threadId || !association)
          throw new Error("Gmail thread attribution is invalid.");
      }
      if (threadId && rows[0] && rows[0].gmailThreadId !== threadId)
        throw new GmailThreadAttributionChangedError();
      if (threadId && binding && rows[0]) {
        const match = await findEnrollmentByThread(
          transaction,
          threadId,
          binding,
        );
        const valid =
          attribution === "unbound"
            ? match.kind === "unknown" &&
              match.safeToPause &&
              match.enrollment.id === sequenceId
            : match.kind === "unique" && match.enrollment.id === sequenceId;
        if (!valid) throw new GmailThreadAttributionChangedError();
      }
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
      const rows = await transaction<Array<{ id: string }>>`
        insert into growth.suppressions (
          normalised_email, business_id, reason, source, created_by
        ) values (
          ${input.normalisedEmail}, ${input.businessId}, ${input.reason}, ${input.source}, ${input.createdBy}
        )
        on conflict (normalised_email) do nothing
        returning id
      `;
      return rows.length > 0;
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
      operation(createSequenceStopTransaction(transaction)),
    );
  },
};
