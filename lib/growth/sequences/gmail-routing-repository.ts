import { loadProvenReferences } from "./gmail-reference-attribution";
import { parseGmailRecipients } from "../integrations/gmail/recipients";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { lockCurrentGmailGrant } from "../integrations/gmail/grant";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import {
  gmailThreadCandidates,
  resolveGmailThreadCandidates,
  lockGmailThread,
  lockGmailRouting,
  type ThreadCandidate,
} from "./gmail-thread-association";
import { parseGmailReferences } from "./gmail-references";
import {
  assessGmailRouting,
  gmailFromAddress,
  type GmailRouting,
  type ReferenceCandidate,
} from "./gmail-routing";

export type GmailRoutingInput = {
  binding: GmailGrantBinding;
  threadId: string;
  inReplyTo: string | null;
  references: string | null;
  fromAddress: string | null;
  fromHeader?: string | null;
};
export type GmailEffectObservation = Readonly<
  Omit<GmailRoutingInput, "binding"> & {
    messageId: string;
    historyId: string;
    fromHeader: string | null;
  }
>;

export function validateGmailObservation(
  value: unknown,
): asserts value is Omit<GmailRoutingInput, "binding"> {
  if (!value || typeof value !== "object")
    throw new TypeError("Gmail observation is invalid.");
  if (
    !("threadId" in value) ||
    !("inReplyTo" in value) ||
    !("references" in value) ||
    !("fromAddress" in value)
  )
    throw new TypeError("Gmail observation is invalid.");
  const observation = value;
  if (
    "fromHeader" in value &&
    value.fromHeader !== undefined &&
    value.fromHeader !== null &&
    (typeof value.fromHeader !== "string" || value.fromHeader.length > 32768)
  )
    throw new TypeError("Gmail observation is invalid.");
  if (
    typeof observation.threadId !== "string" ||
    !observation.threadId.trim() ||
    observation.threadId !== observation.threadId.trim() ||
    observation.threadId.length > 256 ||
    ![
      observation.inReplyTo,
      observation.references,
      observation.fromAddress,
    ].every(
      (item) =>
        item === null || (typeof item === "string" && item.length <= 32768),
    )
  )
    throw new TypeError("Gmail observation is invalid.");
}

export function validateGmailEffectObservation(
  value: unknown,
): asserts value is GmailEffectObservation {
  validateGmailObservation(value);
  if (
    !("messageId" in value) ||
    typeof value.messageId !== "string" ||
    !value.messageId.trim() ||
    value.messageId !== value.messageId.trim() ||
    value.messageId.length > 256 ||
    !("historyId" in value) ||
    typeof value.historyId !== "string" ||
    !/^\d{1,32}$/.test(value.historyId) ||
    !("fromHeader" in value) ||
    !(
      value.fromHeader === null ||
      (typeof value.fromHeader === "string" && value.fromHeader.length <= 32768)
    ) ||
    gmailFromAddress(value.fromHeader) !== value.fromAddress
  )
    throw new TypeError("Gmail observation is invalid.");
}

// The wrapper starts a fresh transaction and takes the global lock before the thread lock.
export async function classifyGmailRouting(
  db: GrowthDb,
  input: GmailRoutingInput,
): Promise<GmailRouting> {
  return withGrowthTransaction(db, (tx) =>
    classifyGmailRoutingInTransaction(tx, input),
  );
}

// Call before other locks, or after this transaction already holds the global lock.
export async function classifyGmailRoutingInTransaction(
  tx: GrowthTransaction,
  input: GmailRoutingInput,
): Promise<GmailRouting> {
  validateGmailObservation(input);
  const references = parseGmailReferences(input.inReplyTo, input.references);
  await lockGmailRouting(tx);
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
      safe_messages as (
        select em.id from growth.email_messages em
        where em.direction='outbound' and em.channel='gmail' and em.attempt_count > 0
          and em.status not in ('draft','provider_draft','sent')
          and em.provider_draft_id is null and em.provider_message_id is null
          and (select count(distinct r.lease_token) from growth.outreach_reservations r where r.email_message_id=em.id) = em.attempt_count
          and (select count(*) from growth.outreach_reservations r where r.email_message_id=em.id) = em.attempt_count
          and not exists (select 1 from growth.outreach_reservations r where r.email_message_id=em.id
            and (r.connection_id is null or not ((r.status='cancelled' and r.submitted_at is null and r.issued_snapshot is null)
              or (r.status='rejected' and r.direct_noninvocation_evidence is not null))))
      ), referenced_messages as (
        select id from growth.email_messages where rfc_message_id=any(${tx.array(ids)}::text[])
        union
        select email_message_id as id from growth.outreach_reservations where rfc_message_id=any(${tx.array(ids)}::text[])
      ), reference_rows as (
        select distinct em.sequence_enrollment_id as "sequenceId", em.channel, r.connection_id as "connectionId",r.id as "reservationId",
          (r.rfc_message_id is not null and em.rfc_message_id is distinct from r.rfc_message_id) as "identityConflict"
        from referenced_messages ref
        join growth.email_messages em on em.id=ref.id and em.direction='outbound'
        left join growth.outreach_reservations r on r.email_message_id=em.id
          and not ((r.status='cancelled' and r.submitted_at is null and r.issued_snapshot is null)
            or (r.status='rejected' and r.direct_noninvocation_evidence is not null))
        limit 101
      )
      select coalesce((select jsonb_agg(to_jsonb(t)) from thread_rows t),'[]'::jsonb) as "threadRows",
        coalesce((select jsonb_agg(to_jsonb(r)) from reference_rows r),'[]'::jsonb) as candidates,
        case when exists(select 1 from thread_rows where bound) or (select count(*) from thread_rows) > 1 then false else exists (
          select 1 from growth.email_messages em
          join growth.sequence_enrollments se on se.id=em.sequence_enrollment_id
          where em.channel='gmail' and em.direction='outbound'
            and not exists(select 1 from safe_messages safe where safe.id=em.id)
            and not exists(select 1 from thread_rows observed where observed.id=se.id)
            and (
              em.status in ('draft','provider_draft','sending') or em.provider_draft_id is not null
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
        ) or exists (
          select 1 from growth.outreach_reservations rr join growth.email_messages rem on rem.id=rr.email_message_id
          where rem.channel='resend' and rem.direction='outbound' and rr.issued_snapshot is not null
            and (rr.outreach_provider='resend' and rr.status='rejected' and rr.direct_noninvocation_evidence->>'kind'='resend_send_not_invoked_v1') is not true
            and (rr.issued_snapshot->'monitoredMailbox'->>'connectionId' is null or rr.issued_snapshot->'monitoredMailbox'->>'connectionId'=${input.binding.connectionId})
        ) end as "possibleExposure",
        case when exists(select 1 from thread_rows where bound) or (select count(*) from thread_rows) > 1 then false else exists (
          select 1 from growth.sequence_enrollments se
          join growth.contacts c on c.id=se.contact_id
          where ${address}::text is not null and (c.normalised_email=${address} or lower(se.template_snapshot->>'approvedRecipient')=${address})
            and not exists(select 1 from thread_rows observed where observed.id=se.id)
            and exists(select 1 from growth.email_messages outbound where outbound.sequence_enrollment_id=se.id and outbound.direction='outbound'
              and not exists(select 1 from safe_messages safe where safe.id=outbound.id)
              and (outbound.channel='gmail' and (outbound.status in ('draft','provider_draft') or outbound.provider_draft_id is not null or outbound.attempt_count>0)
                or not exists(select 1 from growth.outreach_reservations known where known.email_message_id=outbound.id and known.connection_id is not null)
                or exists(select 1 from growth.outreach_reservations current_account where current_account.email_message_id=outbound.id and current_account.connection_id=${input.binding.connectionId})))
        ) end as "contactSignal"
    `;
  if (!snapshot) throw new Error("Gmail routing evidence unavailable.");
  const thread = resolveGmailThreadCandidates(snapshot.threadRows);
  const candidates = snapshot.candidates;
  const from = parseGmailRecipients({
    to: input.fromHeader ?? null,
    cc: null,
    bcc: null,
  });
  const exactFrom =
    from && from.to.length === 1 && from.to[0] === address ? from.to[0] : null;
  const [mailbox] =
    exactFrom && ids.length
      ? await tx<
          { address: string }[]
        >`select subject_email as address from growth.integration_connections where id=${input.binding.connectionId} and provider='gmail' for share`
      : [];
  const proven =
    exactFrom && ids.length && mailbox?.address
      ? await loadProvenReferences(
          tx,
          ids,
          exactFrom,
          input.binding,
          mailbox.address,
        )
      : [];

  return assessGmailRouting({
    thread,
    references,
    inReplyTo: parseGmailReferences(input.inReplyTo, null),
    candidates,
    candidatesOverflow: candidates.length > 100 || proven.length > 100,
    proven,
    possibleExposure: snapshot.possibleExposure,
    contactSignal: snapshot.contactSignal,
    connectionId: input.binding.connectionId,
  });
}
