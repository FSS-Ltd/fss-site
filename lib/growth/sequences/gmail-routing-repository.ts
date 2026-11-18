import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockCurrentGmailGrant } from "../integrations/gmail/grant";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import {
  gmailThreadCandidates,
  resolveGmailThreadCandidates,
  lockGmailThread,
  type ThreadCandidate,
} from "./gmail-thread-association";
import { parseGmailReferences } from "./gmail-references";
import {
  assessGmailRouting,
  type GmailRouting,
  type ReferenceCandidate,
} from "./gmail-routing";

export type GmailRoutingInput = {
  binding: GmailGrantBinding;
  threadId: string;
  inReplyTo: string | null;
  references: string | null;
  fromAddress: string | null;
};

// Call only outside business/account transactions: thread lock is always first.
export async function classifyGmailRouting(
  db: GrowthDb,
  input: GmailRoutingInput,
): Promise<GmailRouting> {
  const references = parseGmailReferences(input.inReplyTo, input.references);
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailThread(tx, input.threadId);
    await lockCurrentGmailGrant(tx, input.binding);
    const address =
      input.fromAddress &&
      input.fromAddress.length <= 320 &&
      /^[^\s<>@]+@[^\s<>@]+$/.test(input.fromAddress)
        ? input.fromAddress.toLowerCase()
        : null;
    const ids = references.kind === "valid" ? [...references.ids] : [];
    const [snapshot] = await tx<
      Array<{
        threadRows: ThreadCandidate[];
        candidates: ReferenceCandidate[];
        possibleExposure: boolean;
        contactSignal: boolean;
      }>
    >`
      with thread_rows as (${gmailThreadCandidates(tx, input.threadId, input.binding)}),
      referenced_messages as (
        select id from growth.email_messages where rfc_message_id=any(${tx.array(ids)}::text[])
        union
        select email_message_id as id from growth.outreach_reservations where rfc_message_id=any(${tx.array(ids)}::text[])
      ), reference_rows as (
        select distinct em.sequence_enrollment_id as "sequenceId", em.channel, r.connection_id as "connectionId",
          (r.rfc_message_id is not null and em.rfc_message_id is distinct from r.rfc_message_id) as "identityConflict"
        from referenced_messages ref
        join growth.email_messages em on em.id=ref.id and em.direction='outbound'
        left join growth.outreach_reservations r on r.email_message_id=em.id
        limit 101
      )
      select coalesce((select jsonb_agg(to_jsonb(t)) from thread_rows t),'[]'::jsonb) as "threadRows",
        coalesce((select jsonb_agg(to_jsonb(r)) from reference_rows r),'[]'::jsonb) as candidates,
        case when exists(select 1 from thread_rows where bound) or (select count(*) from thread_rows) > 1 then false else exists (
          select 1 from growth.email_messages em
          join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
          where em.channel='gmail' and em.direction='outbound'
            and not exists(select 1 from thread_rows observed where observed.id=se.id)
            and (
              em.status in ('provider_draft','sending') or em.provider_draft_id is not null
              or ((em.attempt_count > 0 or em.status='sent' or em.provider_message_id is not null) and (em.status <> 'sent' or em.attempt_count > 1 or not exists(
                select 1 from growth.outreach_reservations complete
                join growth.outreach_account_controls control on control.connection_id=complete.connection_id and control.verified_subject=${input.binding.googleSubject}
                where complete.email_message_id=em.id and complete.sequence_id=se.id and complete.connection_id=${input.binding.connectionId}
                  and complete.status='accepted' and complete.provider_message_id is not null
                  and em.status='sent' and em.provider_message_id=complete.provider_message_id
                  and em.provider_thread_id=complete.provider_thread_id
                  and complete.rfc_message_id=em.rfc_message_id
                  and complete.provider_thread_id=se.gmail_thread_id and se.gmail_thread_id is not null)))
              or exists(select 1 from growth.outreach_reservations issued
                where issued.email_message_id=em.id and (issued.connection_id is null or issued.connection_id=${input.binding.connectionId})
                  and (issued.submitted_at is not null or issued.status in ('submitting','uncertain','accepted','sent','rejected','cancelled'))
                  and (issued.status <> 'accepted' or issued.connection_id is distinct from ${input.binding.connectionId}
                    or issued.provider_message_id is null or se.gmail_thread_id is null
                    or em.status <> 'sent' or em.provider_message_id is distinct from issued.provider_message_id
                    or em.provider_thread_id is distinct from issued.provider_thread_id
                    or issued.rfc_message_id is distinct from em.rfc_message_id
                    or issued.provider_thread_id is distinct from se.gmail_thread_id
                    or not exists(select 1 from growth.outreach_account_controls control where control.connection_id=issued.connection_id and control.verified_subject=${input.binding.googleSubject})))
            )
        ) end as "possibleExposure",
        case when exists(select 1 from thread_rows where bound) or (select count(*) from thread_rows) > 1 then false else exists (
          select 1 from growth.sequence_enrollments se
          join growth.contacts c on c.id=se.contact_id
          where ${address}::text is not null and (c.normalised_email=${address} or lower(se.template_snapshot->>'approvedRecipient')=${address})
            and not exists(select 1 from thread_rows observed where observed.id=se.id)
            and exists(select 1 from growth.email_messages outbound where outbound.sequence_enrollment_id=se.id and outbound.direction='outbound'
              and (outbound.channel='gmail' and (outbound.status='provider_draft' or outbound.provider_draft_id is not null or outbound.attempt_count>0)
                or not exists(select 1 from growth.outreach_reservations known where known.email_message_id=outbound.id and known.connection_id is not null)
                or exists(select 1 from growth.outreach_reservations current_account where current_account.email_message_id=outbound.id and current_account.connection_id=${input.binding.connectionId})))
        ) end as "contactSignal"
    `;
    if (!snapshot) throw new Error("Gmail routing evidence unavailable.");
    const thread = resolveGmailThreadCandidates(snapshot.threadRows);
    const candidates = snapshot.candidates;

    return assessGmailRouting({
      thread,
      references,
      candidates,
      candidatesOverflow: candidates.length > 100,
      possibleExposure: snapshot.possibleExposure,
      contactSignal: snapshot.contactSignal,
      connectionId: input.binding.connectionId,
    });
  });
}
