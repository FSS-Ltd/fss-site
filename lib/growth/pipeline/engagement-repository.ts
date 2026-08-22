import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  EngagementTransitionRepository,
  EngagementTransitionTransaction,
  LockedEngagement,
} from "./transition-engagement";

const ACTIVE_ENROLLMENT_STATUSES = ["pending_approval", "active", "paused"];

function createTransaction(
  transaction: GrowthTransaction,
): EngagementTransitionTransaction {
  return {
    async lockEngagement(engagementId) {
      const rows = await transaction<Array<LockedEngagement>>`
        select
          id,
          prospect_id as "prospectId",
          version,
          stage,
          delivery_status as "deliveryStatus"
        from growth.delivery_engagements
        where id = ${engagementId}
        for update
      `;
      return rows[0] ?? null;
    },

    async applyCommercialTransition(input) {
      await transaction`
        update growth.delivery_engagements
        set stage = ${input.toStage},
            version = version + 1,
            won_at = ${input.wonAt},
            lost_at = ${input.lostAt},
            loss_reason = ${input.lossReason},
            one_off_value_pence = coalesce(${input.oneOffValuePence}, one_off_value_pence),
            monthly_value_pence = coalesce(${input.monthlyValuePence}, monthly_value_pence),
            updated_at = now()
        where id = ${input.engagementId}
      `;
    },

    async applyDeliveryTransition(input) {
      await transaction`
        update growth.delivery_engagements
        set delivery_status = ${input.toStatus},
            version = version + 1,
            updated_at = now()
        where id = ${input.engagementId}
      `;
    },

    async insertStageEvent(input) {
      await transaction`
        insert into growth.commercial_stage_events (
          engagement_id, dimension, from_state, to_state,
          reason_code, actor_type, actor_id, correlation_id
        ) values (
          ${input.engagementId}, ${input.dimension}, ${input.fromState}, ${input.toState},
          ${input.reasonCode}, 'founder', ${input.actorId}, ${input.correlationId}
        )
      `;
    },

    async stopActiveOutreachForProspect(prospectId) {
      const enrollments = await transaction<Array<{ id: string }>>`
        select id from growth.sequence_enrollments
        where prospect_id = ${prospectId}
          and status = any(${ACTIVE_ENROLLMENT_STATUSES}::text[])
        for update
      `;
      if (enrollments.length === 0) return { stoppedCount: 0 };

      const ids = enrollments.map((row) => row.id);

      await transaction`
        update growth.email_messages
        set status = 'cancelled',
            lease_token = null,
            lease_expires_at = null,
            last_error_code = 'engagement_transitioned',
            updated_at = now()
        where sequence_enrollment_id = any(${ids}::uuid[])
          and status in ('queued', 'retry')
      `;

      await transaction`
        update growth.sequence_enrollments
        set status = 'stopped_started_talks',
            stopped_at = now(),
            stop_reason = 'started_talks',
            updated_at = now()
        where id = any(${ids}::uuid[])
      `;

      return { stoppedCount: ids.length };
    },

    appendTransitionAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: `engagement.${input.dimension}_transitioned.${input.toState}`,
        entityType: "delivery_engagement",
        entityId: input.engagementId,
      });
    },

    async hasClientThankYou(engagementId) {
      const rows = await transaction<Array<{ exists: boolean }>>`
        select exists (
          select 1 from growth.client_messages where engagement_id = ${engagementId}
        ) as exists
      `;
      return rows[0]?.exists === true;
    },

    async getWonRecipientForThankYou(engagementId) {
      const rows = await transaction<
        Array<{
          engagementName: string;
          contactId: string;
          firstName: string;
          normalisedEmail: string;
          alreadySubscribed: boolean;
        }>
      >`
        select
          de.name as "engagementName",
          c.id as "contactId",
          c.first_name as "firstName",
          c.normalised_email as "normalisedEmail",
          exists (
            select 1 from growth.newsletter_subscribers ns
            where ns.normalised_email = c.normalised_email
              and ns.status = 'subscribed'
          ) as "alreadySubscribed"
        from growth.delivery_engagements de
        inner join growth.prospects p on p.id = de.prospect_id
        inner join growth.contacts c on c.id = p.primary_contact_id
        where de.id = ${engagementId}
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        contactId: row.contactId,
        firstName: row.firstName,
        engagementName: row.engagementName,
        alreadySubscribed: row.alreadySubscribed,
      };
    },

    async createClientThankYou(input) {
      await transaction`
        insert into growth.client_messages (
          engagement_id, template_key, included_newsletter_invite,
          recipient_contact_id, subject_snapshot, html_snapshot, text_snapshot,
          checksum, created_by
        ) values (
          ${input.engagementId}, 'client-delivery-thank-you', ${input.includedNewsletterInvite},
          ${input.recipientContactId}, ${input.subjectSnapshot}, ${input.htmlSnapshot}, ${input.textSnapshot},
          ${input.checksum}, ${input.createdBy}
        )
        on conflict (engagement_id) do nothing
      `;
    },
  };
}

export const postgresEngagementTransitionRepository: EngagementTransitionRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
