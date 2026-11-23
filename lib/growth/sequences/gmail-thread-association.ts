import type { GrowthQueryExecutor, GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";

export class GmailThreadAttributionChangedError extends Error {
  constructor(readonly classification: "unknown" | "ambiguous" = "unknown") {
    super("Gmail thread attribution changed.");
  }
}

export type ThreadEnrollment = {
  id: string;
  status: string;
  prospectId: string;
  contactId: string;
};

export type ExactReplyAttribution = {
  basis: "gmail_exact_reference_v1";
  outboundProvider: "gmail" | "resend";
  reservationId: string;
  rfcMessageId: string;
  connectionId: string;
  googleSubject: string;
  grantEpoch: number;
  recipient: string;
};

export type ThreadMatch =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | {
      kind: "unique";
      enrollment: ThreadEnrollment;
      attribution?: ExactReplyAttribution;
    }
  | { kind: "unknown"; enrollment: ThreadEnrollment; safeToPause: boolean };

// Legacy evidence can be unbound, so serialize routing writers across accounts.
// Acquire this before thread, business, grant or row locks; never across I/O.
export async function lockGmailRouting(tx: GrowthTransaction): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended('growth:gmail-routing', 0))`;
}

export async function lockGmailThread(
  tx: GrowthTransaction,
  threadId: string,
): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:gmail-thread:${threadId}`}, 0))`;
}

export type ThreadCandidate = ThreadEnrollment & {
  bound: boolean;
  hasAssociation: boolean;
};

export function gmailThreadCandidates(
  db: GrowthQueryExecutor,
  gmailThreadId: string,
  binding: GmailGrantBinding,
) {
  return db<ThreadCandidate[]>`
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
}

export function resolveGmailThreadCandidates(
  rows: readonly ThreadCandidate[],
): ThreadMatch {
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

export async function findEnrollmentByThread(
  db: GrowthQueryExecutor,
  gmailThreadId: string,
  binding: GmailGrantBinding,
): Promise<ThreadMatch> {
  return resolveGmailThreadCandidates(
    await gmailThreadCandidates(db, gmailThreadId, binding),
  );
}
