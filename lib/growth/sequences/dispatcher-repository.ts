import { withGrowthTransaction } from "../db/client";
import { lockGmailRouting, lockGmailThread } from "./gmail-thread-association";
import type { GrowthDb } from "../db/types";
import { renderPublishedFollowUpContent } from "../email/gmail/render";
import { auditReservation } from "../campaigns/reservation-shared";

export type ClaimedMessage = {
  id: string;
  previousStatus: "queued" | "retry" | "sending";
  manualOnly?: boolean;
  approvedRecipient?: string | null;
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
  lawfulBasis?: string;
  subscriberType?: string;
  prospectStatus?: string;
  corporateStatus?: string;
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
  claimPendingConfirmations(
    db: GrowthDb,
    connectionId: string,
  ): Promise<string[]>;
  prepareLegacyMessage(
    db: GrowthDb,
    input: { messageId: string; leaseToken: string; claimed: ClaimedMessage },
  ): Promise<{ status: "ready" } | { status: "held"; reason: string }>;
  claimDueMessage(
    db: GrowthDb,
    input: {
      now: Date;
      leaseToken: string;
      leaseExpiresAt: Date;
      messageId?: string;
      excludeMessageIds?: readonly string[];
      channel?: "gmail" | "resend";
    },
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

async function claimPendingConfirmations(
  db: GrowthDb,
  connectionId: string,
): Promise<string[]> {
  return withGrowthTransaction(db, async (tx) => {
    const rows = await tx<{ id: string }[]>`
      with due as (
        select id from growth.outreach_reservations
        where connection_id=${connectionId} and status='accepted'
          and direct_submission_evidence is not null and confirmation_receipt is null
          and confirmation_observed_at is null and completed_at is not null
          and coalesce(confirmation_next_attempt_at,completed_at)<=clock_timestamp()
        order by coalesce(confirmation_next_attempt_at,completed_at),id
        for update skip locked limit 25
      )
      update growth.outreach_reservations r
      set confirmation_next_attempt_at=clock_timestamp()+interval '15 minutes'
      from due where r.id=due.id returning r.id`;
    return rows.map((row) => row.id);
  });
}

async function prepareLegacyMessage(
  db: GrowthDb,
  input: { messageId: string; leaseToken: string; claimed: ClaimedMessage },
): Promise<{ status: "ready" } | { status: "held"; reason: string }> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [identity] = await tx<
      {
        prospectId: string;
        businessId: string;
        contactId: string;
        sequenceId: string;
      }[]
    >`
      select p.id as "prospectId", p.business_id as "businessId", ct.id as "contactId", se.id as "sequenceId"
      from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
      join growth.prospects p on p.id=se.prospect_id join growth.contacts ct on ct.id=se.contact_id
      where em.id=${input.messageId}`;
    if (!identity) return { status: "held", reason: "lease_invalid" };
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:outreach-business:${identity.businessId}`},0))`;
    await tx`select id from growth.prospects where id=${identity.prospectId} for share`;
    await tx`select id from growth.businesses where id=${identity.businessId} for share`;
    await tx`select id from growth.contacts where id=${identity.contactId} for share`;
    await tx`select id from growth.sequence_enrollments where id=${identity.sequenceId} for share`;
    await tx`select id from growth.email_messages where sequence_enrollment_id=${identity.sequenceId} and step_number=0 for share`;
    const rows = await tx<
      {
        step: number;
        subject: string | null;
        html: string | null;
        text: string | null;
        firstName: string;
        businessName: string;
        firstSubject: string | null;
        campaign: boolean;
      }[]
    >`
      select em.step_number as step, em.subject_snapshot as subject, em.html_snapshot as html, em.text_snapshot as text,
        ct.first_name as "firstName", coalesce(b.trading_name,b.legal_name) as "businessName",
        first_message.subject_snapshot as "firstSubject",
        exists(select 1 from growth.campaign_memberships m where m.sequence_id=se.id) as campaign
      from growth.email_messages em join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
      join growth.prospects p on p.id=se.prospect_id join growth.businesses b on b.id=p.business_id
      join growth.contacts ct on ct.id=se.contact_id
      left join growth.email_messages first_message on first_message.sequence_enrollment_id=se.id and first_message.step_number=0
      where em.id=${input.messageId} and em.status='sending' and em.lease_token=${input.leaseToken}
        and em.lease_expires_at > clock_timestamp() for update of em`;
    if (rows.length !== 1) return { status: "held", reason: "lease_invalid" };
    const row = rows[0];
    if (!row) return { status: "held", reason: "lease_invalid" };
    if (
      row.step !== input.claimed.stepNumber ||
      row.subject !== input.claimed.subjectSnapshot ||
      row.html !== input.claimed.htmlSnapshot ||
      row.text !== input.claimed.textSnapshot
    )
      return { status: "held", reason: "claimed_content_changed" };
    if (row.campaign || (row.subject && row.html && row.text))
      return { status: "ready" };
    if (row.subject || row.html || row.text || ![1, 3].includes(row.step))
      return { status: "held", reason: "message_unprepared" };
    const templateKey =
      row.step === 1 ? "gmail_follow_up_day_5" : "gmail_follow_up_day_20";
    const [template] = await tx<{ html: string; text: string }[]>`
      select html_template as html,text_template as text from growth.email_templates
      where channel='gmail' and template_key=${templateKey} and status='published'
      order by version desc limit 1 for share`;
    if (
      !template ||
      !row.firstSubject ||
      !row.firstName.trim() ||
      !row.businessName.trim()
    )
      return { status: "held", reason: "message_unprepared" };
    const content = renderPublishedFollowUpContent({
      subject: row.firstSubject,
      snapshot: {
        status: "published",
        htmlTemplate: template.html,
        textTemplate: template.text,
        requiredFields: ["firstName", "businessName"],
      },
      mergeFields: {
        firstName: row.firstName.trim(),
        businessName: row.businessName.trim(),
      },
    });
    const updated = await tx<{ id: string }[]>`
      update growth.email_messages set subject_snapshot=${content.subject},html_snapshot=${content.html},text_snapshot=${content.text},updated_at=now()
      where id=${input.messageId} and status='sending' and lease_token=${input.leaseToken} and lease_expires_at>clock_timestamp()
        and subject_snapshot is null and html_snapshot is null and text_snapshot is null returning id`;
    return updated.length === 1
      ? { status: "ready" }
      : { status: "held", reason: "lease_invalid" };
  });
}

async function claimDueMessage(
  db: GrowthDb,
  input: {
    now: Date;
    leaseToken: string;
    leaseExpiresAt: Date;
    messageId?: string;
    excludeMessageIds?: readonly string[];
    channel?: "gmail" | "resend";
  },
): Promise<ClaimedMessage | null> {
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [expired] = await tx<{ id: string }[]>`
      select r.id from growth.outreach_reservations r
      join growth.email_messages em on em.id=r.email_message_id
      where em.channel=${input.channel ?? "gmail"}
        and (${input.channel ?? "gmail"}='gmail' or (em.step_number=0 and exists (
          select 1 from growth.campaign_memberships m
          join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
          where m.sequence_id=em.sequence_enrollment_id and c.policy->>'provider'='resend'
        )))
        and r.status='reserved' and r.connection_id is not null
        and r.submitted_at is null and r.issued_snapshot is null
        and r.lease_until<=clock_timestamp() and em.status='sending'
        and em.lease_expires_at<=clock_timestamp() and em.lease_token=r.lease_token
        and (${input.messageId ?? null}::uuid is null or em.id=${input.messageId ?? null}::uuid)
      order by r.lease_until,r.id for update of r,em skip locked limit 1`;
    if (expired) {
      await tx`update growth.outreach_reservations set status='cancelled',completed_at=clock_timestamp() where id=${expired.id} and status='reserved' and submitted_at is null and issued_snapshot is null`;
      await auditReservation(tx, expired.id, "cancelled");
    }
    const rows = await tx<Array<ClaimedMessage>>`
    with target as (
      select em.id, em.status as "previousStatus",
        se.template_snapshot ->> 'followUpPolicy' = 'manual_only' as "manualOnly",
        se.template_snapshot ->> 'approvedRecipient' as "approvedRecipient"
      from growth.email_messages em
      inner join growth.sequence_enrollments se on se.id = em.sequence_enrollment_id
      where em.channel=${input.channel ?? "gmail"}
      and (${input.channel ?? "gmail"}='gmail' or (em.step_number=0 and exists (
        select 1 from growth.campaign_memberships m
        join growth.campaigns c on c.id=m.campaign_id and c.version=m.policy_version
        where m.sequence_id=em.sequence_enrollment_id and c.policy->>'provider'='resend'
      )))
      and ((
          em.status in ('queued', 'retry') and em.scheduled_for <= ${input.now}
        ) or (
          em.status = 'sending' and em.lease_expires_at < ${input.now}
        )) and (${input.messageId ?? null}::uuid is null or em.id = ${input.messageId ?? null}::uuid)
      and not (em.id = any(${input.excludeMessageIds ?? []}::uuid[]))
      and (em.outreach_guarded_claim or (
        em.status='queued' and em.attempt_count=0
        and not exists(select 1 from growth.outreach_reservations r where r.email_message_id=em.id)
      ))
      and not exists (
        select 1 from growth.outreach_reservations r where r.email_message_id=em.id
          and (r.confirmation_observed_at is not null or r.connection_id is null or not (
            (r.status='cancelled' and r.submitted_at is null and r.issued_snapshot is null)
            or (r.status='rejected' and r.direct_noninvocation_evidence is not null)
          ))
      )
      order by case when em.status='sending' then em.lease_expires_at else em.scheduled_for end asc nulls last, em.id
      for update of em skip locked
      limit 1
    )
    update growth.email_messages em
    set status = 'sending',
        outreach_claim_previous_status = target."previousStatus",
        lease_token = ${input.leaseToken},
        lease_expires_at = ${input.leaseExpiresAt},
        outreach_guarded_claim = em.outreach_guarded_claim or (
          target."previousStatus"='queued' and em.attempt_count=0
          and not exists(select 1 from growth.outreach_reservations r where r.email_message_id=em.id)
        ),
        updated_at = now()
    from target
    where em.id = target.id
    returning
      em.id,
      target."previousStatus",
      target."manualOnly",
      target."approvedRecipient",
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
  });
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
      c.lawful_basis as "lawfulBasis", c.subscriber_type as "subscriberType",
      p.status as "prospectStatus", b.corporate_status as "corporateStatus",
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
  await withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await tx`
    update growth.email_messages
    set status = 'cancelled',
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        updated_at = now()
    where id = ${input.messageId}
  `;
  });
}

async function failMessage(
  db: GrowthDb,
  input: FailMessageInput,
): Promise<void> {
  await withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await tx`
    update growth.email_messages
    set status = ${input.status},
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        last_error_summary = ${input.errorSummary},
        updated_at = now()
    where id = ${input.messageId}
  `;
  });
}

export async function recordSent(
  db: GrowthDb,
  input: RecordSentInput,
): Promise<void> {
  await withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    await lockGmailThread(tx, input.providerThreadId);
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
  claimPendingConfirmations,
  prepareLegacyMessage,
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
