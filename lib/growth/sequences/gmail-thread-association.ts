import type { GrowthQueryExecutor, GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";

export class GmailThreadAttributionChangedError extends Error {
  constructor() {
    super("Gmail thread attribution changed.");
  }
}

export type ThreadEnrollment = {
  id: string;
  status: string;
  prospectId: string;
  contactId: string;
};

export type ThreadMatch =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "unique"; enrollment: ThreadEnrollment }
  | { kind: "unknown"; enrollment: ThreadEnrollment; safeToPause: boolean };

export async function lockGmailThread(
  tx: GrowthTransaction,
  threadId: string,
): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:gmail-thread:${threadId}`}, 0))`;
}

export async function findEnrollmentByThread(
  db: GrowthQueryExecutor,
  gmailThreadId: string,
  binding: GmailGrantBinding,
): Promise<ThreadMatch> {
  const rows = await db<
    Array<ThreadEnrollment & { bound: boolean; hasAssociation: boolean }>
  >`
    select se.id, se.status, se.prospect_id as "prospectId", se.contact_id as "contactId",
      exists(select 1 from growth.outreach_reservations r where r.sequence_id=se.id and r.connection_id=${binding.connectionId} and r.provider_thread_id=${gmailThreadId}
        and exists(select 1 from growth.outreach_account_controls c where c.connection_id=r.connection_id and c.verified_subject=${binding.googleSubject})) as bound,
      exists(select 1 from growth.outreach_reservations r where r.sequence_id=se.id and r.provider_thread_id=${gmailThreadId} and r.connection_id is not null) as "hasAssociation"
    from growth.sequence_enrollments se
    where se.gmail_thread_id = ${gmailThreadId}
      and (exists(select 1 from growth.outreach_reservations r where r.sequence_id=se.id and r.connection_id=${binding.connectionId} and r.provider_thread_id=${gmailThreadId})
        or not exists(select 1 from growth.outreach_reservations r where r.sequence_id=se.id and r.provider_thread_id=${gmailThreadId} and r.connection_id is not null))
    limit 2
  `;
  if (rows.length > 1) return { kind: "ambiguous" };
  const row = rows[0];
  if (!row) return { kind: "none" };
  const enrollment = {
    id: row.id,
    status: row.status,
    prospectId: row.prospectId,
    contactId: row.contactId,
  };
  return row.bound
    ? { kind: "unique", enrollment }
    : { kind: "unknown", enrollment, safeToPause: !row.hasAssociation };
}
