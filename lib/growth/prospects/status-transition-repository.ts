import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  ProspectStatusTransitionRepository,
  ProspectStatusTransitionTransaction,
} from "./status-transition";

function createTransaction(
  transaction: GrowthTransaction,
): ProspectStatusTransitionTransaction {
  return {
    async lockProspect(prospectId) {
      const rows = await transaction<
        Array<{
          id: string;
          status: string;
          version: number;
          normalisedEmail: string | null;
          businessId: string;
        }>
      >`
        select
          p.id,
          p.status,
          p.version,
          c.normalised_email as "normalisedEmail",
          p.business_id as "businessId"
        from growth.prospects p
        left join growth.contacts c on c.id = p.primary_contact_id
        where p.id = ${prospectId}
        for update of p
      `;
      return rows[0] ?? null;
    },

    async applyTransition(input) {
      await transaction`
        update growth.prospects
        set status = ${input.status},
            version = version + 1,
            updated_at = now()
        where id = ${input.prospectId}
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

    appendTransitionAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: `prospect.status_transitioned.${input.reason}`,
        entityType: "prospect",
        entityId: input.prospectId,
      });
    },
  };
}

export const postgresProspectStatusTransitionRepository: ProspectStatusTransitionRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
