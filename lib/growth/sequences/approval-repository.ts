import type postgres from "postgres";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import type {
  FirstEmailApprovalRepository,
  FirstEmailApprovalTransaction,
} from "./approval";

export class FirstEmailApprovalPersistenceError extends Error {
  constructor() {
    super("The first-email approval could not be stored.");
    this.name = "FirstEmailApprovalPersistenceError";
  }
}

function toJsonValue(value: unknown): postgres.JSONValue {
  // A successful JSON round trip guarantees the driver receives JSON-safe data.
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function createTransaction(
  transaction: GrowthTransaction,
): FirstEmailApprovalTransaction {
  return {
    async lockDraft(draftTaskId) {
      const rows = await transaction<
        Array<{
          id: string;
          prospectId: string;
          status: string;
          outputSnapshot: unknown;
          completedAt: Date | null;
          contactId: string;
          contactEmail: string;
          normalisedEmail: string;
          subscriberType: string;
          corporateStatus: string;
        }>
      >`
        select
          at.id,
          at.prospect_id as "prospectId",
          at.status,
          at.output_snapshot as "outputSnapshot",
          at.completed_at as "completedAt",
          p.primary_contact_id as "contactId",
          c.email as "contactEmail",
          c.normalised_email as "normalisedEmail",
          c.subscriber_type as "subscriberType",
          b.corporate_status as "corporateStatus"
        from growth.agent_tasks at
        inner join growth.prospects p on p.id = at.prospect_id
        inner join growth.contacts c on c.id = p.primary_contact_id
        inner join growth.businesses b on b.id = p.business_id
        where at.id = ${draftTaskId}
          and at.task_type = 'first_email_draft'
        for update of at, p
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

    async isSuppressed(normalisedEmail) {
      const rows = await transaction<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from growth.suppressions
          where normalised_email = ${normalisedEmail}
        ) as exists
      `;
      return rows[0]?.exists === true;
    },

    async getApprovedAsset(assetId, prospectId) {
      const rows = await transaction<
        Array<{
          url: string;
          width: number;
          height: number;
          byteSize: number;
          altText: string;
          reviewStatus: string;
        }>
      >`
        select
          blob_url as "url",
          width,
          height,
          byte_size as "byteSize",
          alt_text as "altText",
          review_status as "reviewStatus"
        from growth.email_assets
        where id = ${assetId}
          and prospect_id = ${prospectId}
      `;
      return rows[0] ?? null;
    },

    async createEnrollmentAndFirstMessage(input) {
      const enrollmentRows = await transaction<Array<{ id: string }>>`
        insert into growth.sequence_enrollments (
          prospect_id, contact_id, status
        ) values (
          ${input.prospectId}, ${input.contactId}, ${input.enrollmentStatus}
        )
        returning id
      `;
      const sequenceEnrollmentId = enrollmentRows[0]?.id;
      if (!sequenceEnrollmentId) {
        throw new FirstEmailApprovalPersistenceError();
      }

      const messageRows = await transaction<Array<{ id: string }>>`
        insert into growth.email_messages (
          id, sequence_enrollment_id, prospect_id, contact_id,
          channel, direction, step_number, status,
          subject_snapshot, html_snapshot, text_snapshot,
          email_asset_id, rfc_message_id, idempotency_key, scheduled_for
        ) values (
          ${input.message.id}, ${sequenceEnrollmentId}, ${input.prospectId}, ${input.contactId},
          'gmail', 'outbound', 0, ${input.message.status},
          ${input.message.subjectSnapshot}, ${input.message.htmlSnapshot}, ${input.message.textSnapshot},
          ${input.message.emailAssetId}, ${input.message.rfcMessageId}, ${input.message.idempotencyKey},
          ${input.message.scheduledFor}
        )
        returning id
      `;
      if (!messageRows[0]) {
        throw new FirstEmailApprovalPersistenceError();
      }

      await transaction`
        update growth.sequence_enrollments
        set first_message_id = ${input.message.id}, updated_at = now()
        where id = ${sequenceEnrollmentId}
      `;

      return { sequenceEnrollmentId };
    },

    async markDraftReviewState(draftTaskId, outputSnapshot) {
      const rows = await transaction<Array<{ id: string }>>`
        update growth.agent_tasks
        set output_snapshot = ${transaction.json(toJsonValue(outputSnapshot))},
            updated_at = now()
        where id = ${draftTaskId}
          and task_type = 'first_email_draft'
        returning id
      `;
      if (!rows[0]) {
        throw new FirstEmailApprovalPersistenceError();
      }
    },

    appendApprovalAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "first_email.approved",
        entityType: "agent_task",
        entityId: input.draftTaskId,
        metadata: { approved: true },
      });
    },
  };
}

export const postgresFirstEmailApprovalRepository: FirstEmailApprovalRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },

    async recordProviderDraft(db: GrowthDb, input) {
      const rows = await db<Array<{ id: string }>>`
      update growth.email_messages
      set status = 'provider_draft',
          provider_draft_id = ${input.providerDraftId},
          provider_thread_id = ${input.providerThreadId},
          updated_at = now()
      where id = ${input.messageId}
      returning id
    `;
      if (!rows[0]) {
        throw new FirstEmailApprovalPersistenceError();
      }
    },
  };
