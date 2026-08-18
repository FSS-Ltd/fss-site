import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";

export type PendingDraft = {
  id: string;
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  subjectSnapshot: string | null;
  htmlSnapshot: string | null;
  textSnapshot: string | null;
};

export type ThreadEnrollment = {
  id: string;
  status: string;
  prospectId: string;
  contactId: string;
};

export type RecordInboundEventInput = {
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  rfcMessageId: string | null;
  from: string | null;
  subject: string | null;
  receivedAt: Date;
  eventType: "reply" | "bounce" | "auto_response";
};

export interface GmailSyncRepository {
  getCursor(db: GrowthDb, subjectEmail: string): Promise<string | null>;
  setCursor(
    db: GrowthDb,
    subjectEmail: string,
    historyId: string,
  ): Promise<void>;
  findPendingDraftByRfcMessageId(
    db: GrowthDb,
    rfcMessageId: string,
  ): Promise<PendingDraft | null>;
  findEnrollmentByThread(
    db: GrowthDb,
    gmailThreadId: string,
  ): Promise<ThreadEnrollment | null>;
  recordInboundEvent(
    db: GrowthDb,
    input: RecordInboundEventInput,
  ): Promise<{ alreadyRecorded: boolean }>;
  activatePendingApproval(
    db: GrowthDb,
    sequenceEnrollmentId: string,
  ): Promise<void>;
}

async function getCursor(
  db: GrowthDb,
  subjectEmail: string,
): Promise<string | null> {
  const rows = await db<Array<{ providerCursor: string | null }>>`
    select provider_cursor as "providerCursor"
    from growth.integration_connections
    where provider = 'gmail' and subject_email = ${subjectEmail}
  `;
  return rows[0]?.providerCursor ?? null;
}

async function setCursor(
  db: GrowthDb,
  subjectEmail: string,
  historyId: string,
): Promise<void> {
  await db`
    update growth.integration_connections
    set provider_cursor = ${historyId}, last_synced_at = now(), updated_at = now()
    where provider = 'gmail' and subject_email = ${subjectEmail}
  `;
}

async function findPendingDraftByRfcMessageId(
  db: GrowthDb,
  rfcMessageId: string,
): Promise<PendingDraft | null> {
  const rows = await db<Array<PendingDraft>>`
    select
      id,
      sequence_enrollment_id as "sequenceEnrollmentId",
      prospect_id as "prospectId",
      contact_id as "contactId",
      subject_snapshot as "subjectSnapshot",
      html_snapshot as "htmlSnapshot",
      text_snapshot as "textSnapshot"
    from growth.email_messages
    where rfc_message_id = ${rfcMessageId}
      and direction = 'outbound'
      and status in ('draft', 'provider_draft')
      and step_number = 0
  `;
  return rows[0] ?? null;
}

async function findEnrollmentByThread(
  db: GrowthDb,
  gmailThreadId: string,
): Promise<ThreadEnrollment | null> {
  const rows = await db<Array<ThreadEnrollment>>`
    select id, status, prospect_id as "prospectId", contact_id as "contactId"
    from growth.sequence_enrollments
    where gmail_thread_id = ${gmailThreadId}
  `;
  return rows[0] ?? null;
}

async function recordInboundEvent(
  db: GrowthDb,
  input: RecordInboundEventInput,
): Promise<{ alreadyRecorded: boolean }> {
  return withGrowthTransaction(db, async (tx: GrowthTransaction) => {
    const messageRows = await tx<Array<{ id: string }>>`
      insert into growth.email_messages (
        sequence_enrollment_id, prospect_id, contact_id,
        channel, direction, step_number, status,
        provider_message_id, provider_thread_id, rfc_message_id,
        idempotency_key, received_at
      ) values (
        ${input.sequenceEnrollmentId}, ${input.prospectId}, ${input.contactId},
        'gmail', 'inbound', 0, 'received',
        ${input.gmailMessageId}, ${input.gmailThreadId}, ${input.rfcMessageId},
        ${`inbound:${input.gmailMessageId}`}, ${input.receivedAt}
      )
      on conflict (channel, provider_message_id) where provider_message_id is not null do nothing
      returning id
    `;
    const insertedMessageId = messageRows[0]?.id;
    if (!insertedMessageId) {
      return { alreadyRecorded: true };
    }

    await tx`
      insert into growth.email_events (
        email_message_id, provider, provider_event_id, event_type, occurred_at, sanitised_payload
      ) values (
        ${insertedMessageId}, 'gmail', ${input.gmailMessageId}, ${input.eventType}, ${input.receivedAt},
        ${tx.json({ from: input.from, subject: input.subject })}
      )
      on conflict (provider, provider_event_id) do nothing
    `;

    return { alreadyRecorded: false };
  });
}

async function activatePendingApproval(
  db: GrowthDb,
  sequenceEnrollmentId: string,
): Promise<void> {
  await db`
    update growth.sequence_enrollments
    set status = 'active', updated_at = now()
    where id = ${sequenceEnrollmentId} and status = 'pending_approval'
  `;
}

export const postgresGmailSyncRepository: GmailSyncRepository = {
  getCursor,
  setCursor,
  findPendingDraftByRfcMessageId,
  findEnrollmentByThread,
  recordInboundEvent,
  activatePendingApproval,
};
