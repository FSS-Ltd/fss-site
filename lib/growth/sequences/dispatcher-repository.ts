import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";

export type ClaimedMessage = {
  id: string;
  previousStatus: "queued" | "retry" | "sending";
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  stepNumber: number;
  attemptCount: number;
  rfcMessageId: string | null;
  idempotencyKey: string;
  subjectSnapshot: string | null;
  htmlSnapshot: string | null;
  textSnapshot: string | null;
};

export type SendContext = {
  enrollmentStatus: string;
  gmailThreadId: string | null;
  contactEmail: string;
  normalisedEmail: string;
  firstName: string;
  businessName: string;
  firstEmailSubject: string | null;
};

export type FollowUpTemplate = {
  htmlTemplate: string;
  textTemplate: string;
  requiredFields: readonly string[];
};

export type ThreadReferences = {
  parentMessageId: string | null;
  references: string[];
};

export type ScheduledFollowUpInput = {
  stepNumber: number;
  scheduledFor: Date;
  idempotencyKey: string;
};

export type RecordSentInput = {
  messageId: string;
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  providerMessageId: string;
  providerThreadId: string;
  sentAt: Date;
  rfcMessageId: string;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  followUps: readonly ScheduledFollowUpInput[] | null;
};

export type FailMessageInput = {
  messageId: string;
  status: "retry" | "failed";
  errorCode: string;
  errorSummary: string;
};

export type CancelMessageInput = {
  messageId: string;
  errorCode: string;
};

export interface SequenceDispatchRepository {
  claimDueMessage(
    db: GrowthDb,
    input: { now: Date; leaseToken: string; leaseExpiresAt: Date },
  ): Promise<ClaimedMessage | null>;
  getSendContext(
    db: GrowthDb,
    sequenceEnrollmentId: string,
  ): Promise<SendContext | null>;
  isSuppressed(db: GrowthDb, normalisedEmail: string): Promise<boolean>;
  hasNewerInboundMessage(
    db: GrowthDb,
    sequenceEnrollmentId: string,
  ): Promise<boolean>;
  getFollowUpTemplate(
    db: GrowthDb,
    templateKey: string,
  ): Promise<FollowUpTemplate | null>;
  getThreadReferences(
    db: GrowthDb,
    sequenceEnrollmentId: string,
  ): Promise<ThreadReferences>;
  cancelMessage(db: GrowthDb, input: CancelMessageInput): Promise<void>;
  failMessage(db: GrowthDb, input: FailMessageInput): Promise<void>;
  recordSent(db: GrowthDb, input: RecordSentInput): Promise<void>;
}

async function claimDueMessage(
  db: GrowthDb,
  input: { now: Date; leaseToken: string; leaseExpiresAt: Date },
): Promise<ClaimedMessage | null> {
  const rows = await db<Array<ClaimedMessage>>`
    with target as (
      select em.id, em.status as "previousStatus"
      from growth.email_messages em
      where (
          em.status in ('queued', 'retry') and em.scheduled_for <= ${input.now}
        ) or (
          em.status = 'sending' and em.lease_expires_at < ${input.now}
        )
      order by em.scheduled_for asc nulls last
      for update of em skip locked
      limit 1
    )
    update growth.email_messages em
    set status = 'sending',
        lease_token = ${input.leaseToken},
        lease_expires_at = ${input.leaseExpiresAt},
        attempt_count = em.attempt_count + 1,
        updated_at = now()
    from target
    where em.id = target.id
    returning
      em.id,
      target."previousStatus",
      em.sequence_enrollment_id as "sequenceEnrollmentId",
      em.prospect_id as "prospectId",
      em.contact_id as "contactId",
      em.step_number as "stepNumber",
      em.attempt_count as "attemptCount",
      em.rfc_message_id as "rfcMessageId",
      em.idempotency_key as "idempotencyKey",
      em.subject_snapshot as "subjectSnapshot",
      em.html_snapshot as "htmlSnapshot",
      em.text_snapshot as "textSnapshot"
  `;
  return rows[0] ?? null;
}

async function getSendContext(
  db: GrowthDb,
  sequenceEnrollmentId: string,
): Promise<SendContext | null> {
  const rows = await db<Array<SendContext>>`
    select
      se.status as "enrollmentStatus",
      se.gmail_thread_id as "gmailThreadId",
      c.email as "contactEmail",
      c.normalised_email as "normalisedEmail",
      c.first_name as "firstName",
      coalesce(b.trading_name, b.legal_name) as "businessName",
      first_message.subject_snapshot as "firstEmailSubject"
    from growth.sequence_enrollments se
    inner join growth.prospects p on p.id = se.prospect_id
    inner join growth.contacts c on c.id = se.contact_id
    inner join growth.businesses b on b.id = p.business_id
    left join growth.email_messages first_message
      on first_message.sequence_enrollment_id = se.id
      and first_message.step_number = 0
    where se.id = ${sequenceEnrollmentId}
  `;
  return rows[0] ?? null;
}

async function isSuppressed(
  db: GrowthDb,
  normalisedEmail: string,
): Promise<boolean> {
  const rows = await db<Array<{ exists: boolean }>>`
    select exists (
      select 1 from growth.suppressions where normalised_email = ${normalisedEmail}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function hasNewerInboundMessage(
  db: GrowthDb,
  sequenceEnrollmentId: string,
): Promise<boolean> {
  const rows = await db<Array<{ exists: boolean }>>`
    select exists (
      select 1
      from growth.email_messages inbound
      where inbound.sequence_enrollment_id = ${sequenceEnrollmentId}
        and inbound.direction = 'inbound'
        and inbound.received_at > coalesce(
          (
            select max(outbound.sent_at)
            from growth.email_messages outbound
            where outbound.sequence_enrollment_id = ${sequenceEnrollmentId}
              and outbound.direction = 'outbound'
              and outbound.status = 'sent'
          ),
          '-infinity'::timestamptz
        )
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function getFollowUpTemplate(
  db: GrowthDb,
  templateKey: string,
): Promise<FollowUpTemplate | null> {
  const rows = await db<Array<FollowUpTemplate>>`
    select
      html_template as "htmlTemplate",
      text_template as "textTemplate",
      required_fields as "requiredFields"
    from growth.email_templates
    where channel = 'gmail'
      and template_key = ${templateKey}
      and status = 'published'
    order by version desc
    limit 1
  `;
  return rows[0] ?? null;
}

async function getThreadReferences(
  db: GrowthDb,
  sequenceEnrollmentId: string,
): Promise<ThreadReferences> {
  const rows = await db<Array<{ rfcMessageId: string }>>`
    select rfc_message_id as "rfcMessageId"
    from growth.email_messages
    where sequence_enrollment_id = ${sequenceEnrollmentId}
      and direction = 'outbound'
      and status = 'sent'
      and rfc_message_id is not null
    order by step_number asc
  `;
  return {
    parentMessageId: rows.at(-1)?.rfcMessageId ?? null,
    references: rows.map((row) => row.rfcMessageId),
  };
}

async function cancelMessage(
  db: GrowthDb,
  input: CancelMessageInput,
): Promise<void> {
  await db`
    update growth.email_messages
    set status = 'cancelled',
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        updated_at = now()
    where id = ${input.messageId}
  `;
}

async function failMessage(
  db: GrowthDb,
  input: FailMessageInput,
): Promise<void> {
  await db`
    update growth.email_messages
    set status = ${input.status},
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        last_error_summary = ${input.errorSummary},
        updated_at = now()
    where id = ${input.messageId}
  `;
}

async function recordSent(db: GrowthDb, input: RecordSentInput): Promise<void> {
  await withGrowthTransaction(db, async (tx) => {
    await tx`
      update growth.email_messages
      set status = 'sent',
          provider_message_id = ${input.providerMessageId},
          provider_thread_id = ${input.providerThreadId},
          rfc_message_id = coalesce(rfc_message_id, ${input.rfcMessageId}),
          subject_snapshot = coalesce(subject_snapshot, ${input.subjectSnapshot}),
          html_snapshot = coalesce(html_snapshot, ${input.htmlSnapshot}),
          text_snapshot = coalesce(text_snapshot, ${input.textSnapshot}),
          sent_at = ${input.sentAt},
          lease_token = null,
          lease_expires_at = null,
          updated_at = now()
      where id = ${input.messageId}
    `;

    await tx`
      update growth.sequence_enrollments
      set gmail_thread_id = coalesce(gmail_thread_id, ${input.providerThreadId}),
          started_at = coalesce(started_at, ${input.sentAt}),
          updated_at = now()
      where id = ${input.sequenceEnrollmentId}
    `;

    for (const followUp of input.followUps ?? []) {
      await tx`
        insert into growth.email_messages (
          id, sequence_enrollment_id, prospect_id, contact_id,
          channel, direction, step_number, status,
          idempotency_key, scheduled_for
        ) values (
          gen_random_uuid(), ${input.sequenceEnrollmentId}, ${input.prospectId}, ${input.contactId},
          'gmail', 'outbound', ${followUp.stepNumber}, 'queued',
          ${followUp.idempotencyKey}, ${followUp.scheduledFor}
        )
        on conflict (idempotency_key) do nothing
      `;
    }
  });
}

export const postgresSequenceDispatchRepository: SequenceDispatchRepository = {
  claimDueMessage,
  getSendContext,
  isSuppressed,
  hasNewerInboundMessage,
  getFollowUpTemplate,
  getThreadReferences,
  cancelMessage,
  failMessage,
  recordSent,
};
