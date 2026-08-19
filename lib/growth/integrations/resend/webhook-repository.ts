import type { GrowthDb } from "../../db/types";
import type { ResendDeliveryEventInput, ResendWebhookRepository } from "./webhook";

// Mirrors stop.ts's TERMINAL_STATUSES (not exported from that module) —
// a sequence in one of these statuses should not be re-targeted by a
// suppression event.
const TERMINAL_STATUSES = [
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
];

async function hasDeliveryEvent(db: GrowthDb, providerEventId: string): Promise<boolean> {
  const [row] = await db<Array<{ exists: boolean }>>`
    select exists(
      select 1 from growth.resend_delivery_events where provider_event_id = ${providerEventId}
    ) as exists
  `;
  return row?.exists ?? false;
}

async function recordDeliveryEvent(
  db: GrowthDb,
  input: ResendDeliveryEventInput,
): Promise<{ inserted: boolean }> {
  const [send] = await db<Array<{ id: string }>>`
    select id from growth.newsletter_sends
    where provider_message_id = ${input.providerMessageId}
  `;

  // email_message_id is left null unconditionally: no code path in this
  // codebase writes an `email_messages` row for a Resend send today, so a
  // lookup here would be dead code with nothing to ever match.
  const rows = await db<Array<{ id: string }>>`
    insert into growth.resend_delivery_events (
      provider_event_id, event_type, occurred_at,
      recipient_normalised_email, newsletter_send_id, sanitised_payload
    ) values (
      ${input.providerEventId}, ${input.eventType}, ${input.occurredAt},
      ${input.recipientNormalisedEmail}, ${send?.id ?? null},
      ${db.json({
        event_type: input.eventType,
        provider_message_id: input.providerMessageId,
        recipient_normalised_email: input.recipientNormalisedEmail,
      })}
    )
    on conflict (provider_event_id) do nothing
    returning id
  `;

  return { inserted: rows.length > 0 };
}

async function findSequenceEnrollmentIdsByEmail(
  db: GrowthDb,
  normalisedEmail: string,
): Promise<string[]> {
  const rows = await db<Array<{ id: string }>>`
    select se.id
    from growth.sequence_enrollments se
    inner join growth.prospects p on p.id = se.prospect_id
    inner join growth.contacts c on c.id = se.contact_id
    where c.normalised_email = ${normalisedEmail}
      and se.status not in ${db(TERMINAL_STATUSES)}
  `;
  return rows.map((row) => row.id);
}

async function insertGlobalSuppression(
  db: GrowthDb,
  input: { normalisedEmail: string; reason: "bounce" | "do_not_contact"; source: string; createdBy: string },
): Promise<void> {
  await db`
    insert into growth.suppressions (normalised_email, business_id, reason, source, created_by)
    values (${input.normalisedEmail}, null, ${input.reason}, ${input.source}, ${input.createdBy})
    on conflict (normalised_email) do nothing
  `;
}

export function createPostgresResendWebhookRepository(
  db: GrowthDb,
): ResendWebhookRepository {
  return {
    hasDeliveryEvent: (providerEventId) => hasDeliveryEvent(db, providerEventId),
    recordDeliveryEvent: (input) => recordDeliveryEvent(db, input),
    findSequenceEnrollmentIdsByEmail: (normalisedEmail) =>
      findSequenceEnrollmentIdsByEmail(db, normalisedEmail),
    insertGlobalSuppression: (input) => insertGlobalSuppression(db, input),
  };
}
