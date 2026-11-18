import {
  findEnrollmentByThread,
  type ThreadMatch,
} from "./gmail-thread-association";
export type { ThreadEnrollment, ThreadMatch } from "./gmail-thread-association";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import { stopSequenceInTransaction } from "./stop";
import {
  classifyGmailRouting,
  validateGmailEffectObservation,
  type GmailEffectObservation,
} from "./gmail-routing-repository";
import { GmailThreadAttributionChangedError } from "./gmail-thread-association";
import { createSequenceStopTransaction } from "./stop-repository";
import {
  commitReplyCoverage,
  loadReplySyncState,
} from "./gmail-sync-coverage-repository";
export {
  commitReplyCoverage,
  loadReplySyncState,
  loadReplyCoverage,
} from "./gmail-sync-coverage-repository";

export type PendingDraft = {
  id: string;
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  subjectSnapshot: string | null;
  htmlSnapshot: string | null;
  textSnapshot: string | null;
};

export type RecordInboundEventInput = {
  binding: GmailGrantBinding;
  sequenceEnrollmentId: string;
  prospectId: string;
  contactId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  observation: GmailEffectObservation;
  rfcMessageId: string | null;
  from: string | null;
  subject: string | null;
  receivedAt: Date;
  eventType: "reply" | "bounce" | "auto_response";
  correlationId: string;
};

export interface GmailSyncRepository {
  classifyGmailRouting: typeof classifyGmailRouting;
  loadReplySyncState: typeof loadReplySyncState;
  commitReplyCoverage: typeof commitReplyCoverage;
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
    binding: GmailGrantBinding,
  ): Promise<ThreadMatch>;
  recordInboundEvent(
    db: GrowthDb,
    input: RecordInboundEventInput,
  ): Promise<{
    alreadyRecorded: boolean;
    attributionUnknown?: boolean;
    attributionAmbiguous?: boolean;
  }>;
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

async function recordInboundEvent(
  db: GrowthDb,
  input: RecordInboundEventInput,
): Promise<{
  alreadyRecorded: boolean;
  attributionUnknown?: boolean;
  attributionAmbiguous?: boolean;
}> {
  return withGrowthTransaction(db, async (tx: GrowthTransaction) => {
    validateGmailEffectObservation(input.observation);
    const observation = { ...input.observation };
    const binding = {
      ...input.binding,
      grantedScopes: [...input.binding.grantedScopes],
    };
    if (
      observation.threadId !== input.gmailThreadId ||
      observation.messageId !== input.gmailMessageId ||
      observation.fromHeader !== input.from
    )
      throw new Error("Gmail thread attribution is invalid.");
    const stopTransaction = createSequenceStopTransaction(tx);
    try {
      const enrollment = await stopTransaction.lockEnrollment(
        input.sequenceEnrollmentId,
        binding,
        input.gmailThreadId,
        "bound",
        observation,
      );
      if (!enrollment)
        return { alreadyRecorded: false, attributionUnknown: true };
    } catch (error) {
      if (!(error instanceof GmailThreadAttributionChangedError)) throw error;
      return {
        alreadyRecorded: false,
        attributionUnknown: true,
        attributionAmbiguous: error.classification === "ambiguous",
      };
    }
    if (input.eventType !== "auto_response") {
      await stopSequenceInTransaction(stopTransaction, {
        sequenceId: input.sequenceEnrollmentId,
        reason: input.eventType,
        actor: {
          type: "gmail_sync",
          id: "gmail-sync",
          binding,
          observation,
        },
        correlationId: input.correlationId,
      });
    }
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
      const [existing] = await tx<
        Array<{
          sequenceEnrollmentId: string;
          gmailThreadId: string;
          eventType: string;
        }>
      >`
        select em.sequence_enrollment_id as "sequenceEnrollmentId", em.provider_thread_id as "gmailThreadId", e.event_type as "eventType"
        from growth.email_messages em
        join growth.email_events e on e.email_message_id = em.id and e.provider = 'gmail' and e.provider_event_id = ${input.gmailMessageId}
        where em.channel = 'gmail' and em.provider_message_id = ${input.gmailMessageId} and em.direction = 'inbound'
      `;
      if (
        !existing ||
        existing.sequenceEnrollmentId !== input.sequenceEnrollmentId ||
        existing.gmailThreadId !== input.gmailThreadId ||
        existing.eventType !== input.eventType
      ) {
        throw new Error("Gmail inbound event attribution conflict.");
      }
      return { alreadyRecorded: true };
    }

    const eventRows = await tx<Array<{ id: string }>>`
      insert into growth.email_events (
        email_message_id, provider, provider_event_id, event_type, occurred_at, sanitised_payload
      ) values (
        ${insertedMessageId}, 'gmail', ${input.gmailMessageId}, ${input.eventType}, ${input.receivedAt},
        ${tx.json({ from: input.from, subject: input.subject })}
      )
      on conflict (provider, provider_event_id) do nothing
      returning id
    `;
    if (!eventRows[0])
      throw new Error("Gmail inbound event attribution conflict.");

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
  classifyGmailRouting,
  getCursor,
  setCursor,
  loadReplySyncState,
  commitReplyCoverage,
  findPendingDraftByRfcMessageId,
  findEnrollmentByThread,
  recordInboundEvent,
  activatePendingApproval,
};
