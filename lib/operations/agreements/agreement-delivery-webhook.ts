import { OPERATIONS_EMAIL_FROM } from "../email-identity";
import type { OperationsDb } from "../db/client";

export async function applyAgreementDeliveryEvent(
  db: OperationsDb,
  eventId: string,
  payload: {
    type: "email.delivered" | "email.bounced" | "email.complained";
    created_at?: string;
    data: {
      email_id: string;
      from: string;
      to: string[];
      tags: { operations_job: string };
    };
  },
): Promise<void> {
  // Previously sent messages can still deliver events after the sender changes.
  if (
    payload.data.from !== OPERATIONS_EMAIL_FROM &&
    payload.data.from !== "FSS <hello@faithfulsoftwaresolutions.co.uk>"
  )
    return;
  const kind = payload.type.slice("email.".length);
  await db`
    select operations.record_agreement_delivery(
      ${payload.data.tags.operations_job}::uuid,${eventId},${kind},
      ${payload.data.email_id},${payload.data.to[0]},${payload.created_at ?? null}::timestamptz
    )
  `;
}
