import { z } from "zod";
import { parseGmailRecipients } from "../integrations/gmail/recipients";
import { parseGmailReferences } from "../sequences/gmail-references";
import {
  loadProvenReferenceRows,
  proveReferences,
} from "../sequences/gmail-reference-attribution";
import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import { matchesDirectSubmissionEvidence } from "../campaigns/direct-submission-evidence";
import type { GrowthQueryExecutor } from "../db/types";

export type CampaignReply = {
  messageId: string;
  membershipId: string;
  policyVersion: number;
  prospectVersion: number;
  contactVersion: number;
  receivedAt: string;
  gmailUrl: string;
  review: {
    kind:
      | "positive"
      | "negative"
      | "bot"
      | "out_of_office"
      | "opt_out"
      | "unknown";
    recordedAt: string;
  } | null;
};
export type CampaignReplies =
  | { status: "ready"; items: CampaignReply[]; truncated: boolean }
  | { status: "unavailable" };
type Row = {
  messageId: string;
  membershipId: string;
  policyVersion: number;
  prospectVersion: number;
  contactVersion: number;
  receivedAt: Date;
  threadId: string;
  googleSubject: string;
  connectionId: string;
  grantEpoch: number;
  reviewedMembershipId: string | null;
  reviewedKind: string | null;
  reviewedAt: Date | null;
  reservationId: string | null;
  accountId: string | null;
  reservationConnectionId: string | null;
  reservationGrantEpoch: number | null;
  rfc: string | null;
  hash: string | null;
  providerId: string | null;
  providerThreadId: string | null;
  snapshotSubject: string | null;
  evidence: unknown;
};
type ReplyKind = NonNullable<CampaignReply["review"]>["kind"];
function reviewKind(value: string): ReplyKind | null {
  switch (value) {
    case "positive":
    case "negative":
    case "bot":
    case "out_of_office":
    case "opt_out":
    case "unknown":
      return value;
    default:
      return null;
  }
}
export async function getProspectCampaignReplies(
  prospectId: string,
  founder: FounderSession,
  db: GrowthQueryExecutor,
  now: Date,
): Promise<CampaignReplies> {
  requireCampaignFounder(founder);
  try {
    const rows = await db<Row[]>`
      with candidates as materialized (
        select em.id as "messageId",m.id as "membershipId",m.policy_version as "policyVersion",p.version as "prospectVersion",ct.version as "contactVersion",
          em.received_at as "receivedAt",em.provider_thread_id as "threadId",se.id as "sequenceId",
          ic.id as "connectionId",ic.google_subject as "googleSubject",ic.version as "grantEpoch",
          rev.membership_id as "reviewedMembershipId",rev.review_reply_kind as "reviewedKind",rev.occurred_at as "reviewedAt"
        from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
        join growth.contacts ct on ct.id=p.primary_contact_id
        join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=p.id and se.contact_id=ct.id
        join growth.campaigns policy on policy.id=m.campaign_id and policy.version=m.policy_version
        join growth.integration_connections ic on ic.id=policy.account_connection_id and ic.provider='gmail' and ic.subject_email=${founder.email} and ic.google_subject is not null
        join growth.outreach_account_controls ctrl on ctrl.connection_id=ic.id and ctrl.provider='gmail' and ctrl.verified_subject=ic.google_subject
        join growth.email_messages em on em.sequence_enrollment_id=se.id and em.prospect_id=p.id and em.contact_id=ct.id
          and em.channel='gmail' and em.direction='inbound' and em.status='received' and em.provider_message_id is not null
          and em.provider_thread_id=se.gmail_thread_id and em.received_at is not null and em.received_at<=${now}
        left join growth.outreach_events rev on rev.review_inbound_message_id=em.id
        where m.prospect_id=${prospectId} and m.status in ('review','active','paused','replied') and policy.policy->>'provider'='gmail' and policy.policy->>'accountConnectionId'=policy.account_connection_id::text
          and exists(select 1 from growth.email_events ev where ev.email_message_id=em.id and ev.provider='gmail' and ev.provider_event_id=em.provider_message_id and ev.event_type in ('reply','auto_response'))
          and not exists(select 1 from growth.email_events ev where ev.email_message_id=em.id and ev.provider='gmail' and ev.provider_event_id=em.provider_message_id and ev.outreach_reply_attribution is not null)
          and (select count(*) from growth.campaign_memberships other where other.sequence_id=se.id)=1
          and (select count(*) from growth.sequence_enrollments other where other.gmail_thread_id=se.gmail_thread_id)=1
          and not exists(select 1 from growth.outreach_reservations other where other.provider_thread_id=em.provider_thread_id and (other.connection_id is distinct from ic.id or other.sequence_id is distinct from se.id))
        order by em.received_at desc,em.id limit 21
      )
      select c.*,r.id as "reservationId",r.account_id as "accountId",r.connection_id as "reservationConnectionId",r.grant_epoch as "reservationGrantEpoch",
        r.rfc_message_id as rfc,r.issued_snapshot_hash as hash,r.provider_message_id as "providerId",r.provider_thread_id as "providerThreadId",
        r.issued_snapshot->>'googleSubject' as "snapshotSubject",r.direct_submission_evidence as evidence
      from candidates c left join lateral (
        select id,account_id,connection_id,grant_epoch,rfc_message_id,issued_snapshot_hash,provider_message_id,provider_thread_id,issued_snapshot,direct_submission_evidence
        from growth.outreach_reservations r where r.membership_id=c."membershipId" and r.sequence_id=c."sequenceId" and r.status='accepted'
          and r.provider_thread_id=c."threadId" and r.connection_id=c."connectionId" and r.direct_submission_evidence is not null
        order by r.reserved_at desc,r.id limit 6
      ) r on true order by c."receivedAt" desc,c."messageId",r.id
    `;
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const group = groups.get(row.messageId) ?? [];
      group.push(row);
      groups.set(row.messageId, group);
    }
    const all = [...groups.values()];
    const items: CampaignReply[] = [];
    for (const group of all.slice(0, 20)) {
      const row = group[0]!;
      if (
        group.length > 5 ||
        !(row.receivedAt instanceof Date) ||
        !Number.isFinite(row.receivedAt.getTime()) ||
        row.receivedAt > now ||
        (row.reviewedMembershipId &&
          row.reviewedMembershipId !== row.membershipId)
      )
        continue;
      const matching = group.some(
        (issuer) =>
          issuer.snapshotSubject === row.googleSubject &&
          matchesDirectSubmissionEvidence(issuer.evidence, {
            version: 1,
            kind: "gmail_api_send_message_v1",
            reservationId: issuer.reservationId,
            accountId: issuer.accountId,
            connectionId: issuer.reservationConnectionId,
            googleSubject: issuer.snapshotSubject,
            grantEpoch: issuer.reservationGrantEpoch,
            rfcMessageId: issuer.rfc,
            rawSha256: issuer.hash,
            providerMessageId: issuer.providerId,
            providerThreadId: issuer.providerThreadId,
          }),
      );
      if (!matching) continue;
      let review: CampaignReply["review"] = null;
      if (row.reviewedKind !== null) {
        const kind = reviewKind(row.reviewedKind);
        if (
          !kind ||
          row.reviewedMembershipId !== row.membershipId ||
          !(row.reviewedAt instanceof Date) ||
          !Number.isFinite(row.reviewedAt.getTime()) ||
          row.reviewedAt < row.receivedAt
        )
          continue;
        review = { kind, recordedAt: row.reviewedAt.toISOString() };
      } else if (row.reviewedMembershipId !== null || row.reviewedAt !== null)
        continue;
      items.push({
        messageId: row.messageId,
        membershipId: row.membershipId,
        policyVersion: row.policyVersion,
        prospectVersion: row.prospectVersion,
        contactVersion: row.contactVersion,
        receivedAt: row.receivedAt.toISOString(),
        gmailUrl: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(row.threadId)}`,
        review,
      });
    }
    const exact = await getExactReplies(prospectId, founder, db, now);
    const merged = new Map(
      [...items, ...exact.items].map((item) => [item.messageId, item]),
    );
    const sorted = [...merged.values()].sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt),
    );
    return {
      status: "ready",
      items: sorted.slice(0, 20),
      truncated: all.length > 20 || exact.truncated || sorted.length > 20,
    };
  } catch {
    return { status: "unavailable" };
  }
}

const attributionSchema = z.strictObject({
  basis: z.literal("gmail_exact_reference_v1"),
  outboundProvider: z.enum(["gmail", "resend"]),
  reservationId: z.uuid(),
  rfcMessageId: z.string(),
  connectionId: z.uuid(),
  googleSubject: z.string().trim().min(1).max(512),
  grantEpoch: z.number().int().positive(),
  recipient: z.email(),
});
const monitorScopesSchema = z.object({
  monitoredMailbox: z.object({ grantedScopes: z.array(z.string()).min(1) }),
});
type ExactRow = Pick<
  Row,
  | "messageId"
  | "membershipId"
  | "policyVersion"
  | "prospectVersion"
  | "contactVersion"
  | "receivedAt"
  | "threadId"
  | "reviewedMembershipId"
  | "reviewedKind"
  | "reviewedAt"
> & {
  sequenceId: string;
  policyProvider: string;
  policyConnectionId: string;
  attribution: unknown;
  sourceReservationId: string | null;
  sender: unknown;
  mailboxSubject: string;
  mailboxAddress: string;
  mailboxVersion: number;
};
async function getExactReplies(
  prospectId: string,
  founder: FounderSession,
  db: GrowthQueryExecutor,
  now: Date,
): Promise<{ items: CampaignReply[]; truncated: boolean }> {
  const rows = await db<ExactRow[]>`
    select em.id as "messageId",m.id as "membershipId",m.policy_version as "policyVersion",p.version as "prospectVersion",ct.version as "contactVersion",
      em.received_at as "receivedAt",em.provider_thread_id as "threadId",se.id as "sequenceId",
      policy.policy->>'provider' as "policyProvider",policy.account_connection_id as "policyConnectionId",
      ev.outreach_reply_attribution as attribution,ev.outreach_reply_reservation_id as "sourceReservationId",ev.sanitised_payload->'from' as sender,
      ic.google_subject as "mailboxSubject",ic.subject_email as "mailboxAddress",ic.version as "mailboxVersion",
      rev.membership_id as "reviewedMembershipId",rev.review_reply_kind as "reviewedKind",rev.occurred_at as "reviewedAt"
    from growth.campaign_memberships m join growth.prospects p on p.id=m.prospect_id and p.business_id=m.business_id
    join growth.contacts ct on ct.id=p.primary_contact_id
    join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=p.id and se.contact_id=ct.id
    join growth.campaigns policy on policy.id=m.campaign_id and policy.version=m.policy_version and policy.policy->>'accountConnectionId'=policy.account_connection_id::text
    join growth.email_messages em on em.sequence_enrollment_id=se.id and em.prospect_id=p.id and em.contact_id=ct.id
      and em.channel='gmail' and em.direction='inbound' and em.status='received' and em.provider_message_id is not null and em.provider_thread_id is not null and em.received_at is not null and em.received_at<=${now}
    join growth.email_events ev on ev.email_message_id=em.id and ev.provider='gmail' and ev.provider_event_id=em.provider_message_id and ev.event_type in ('reply','auto_response')
    join growth.integration_connections ic on ic.id::text=ev.outreach_reply_attribution->>'connectionId' and ic.provider='gmail' and ic.subject_email=${founder.email}
    left join growth.outreach_events rev on rev.review_inbound_message_id=em.id
    where m.prospect_id=${prospectId} and m.status in ('review','active','paused','replied')
      and ev.outreach_reply_attribution->>'basis'='gmail_exact_reference_v1'
      and (select count(*) from growth.campaign_memberships other where other.sequence_id=se.id)=1
    order by em.received_at desc,em.id limit 21`;
  const valid = rows.slice(0, 20).flatMap((row) => {
    const proof = attributionSchema.safeParse(row.attribution);
    if (
      !proof.success ||
      row.sourceReservationId !== proof.data.reservationId ||
      row.policyProvider !== proof.data.outboundProvider ||
      row.mailboxSubject !== proof.data.googleSubject ||
      row.mailboxVersion < proof.data.grantEpoch ||
      typeof row.sender !== "string"
    )
      return [];
    const refs = parseGmailReferences(proof.data.rfcMessageId, null);
    const from = parseGmailRecipients({ to: row.sender, cc: null, bcc: null });
    if (
      refs.kind !== "valid" ||
      refs.ids.length !== 1 ||
      !from ||
      from.to.length !== 1 ||
      from.to[0] !== proof.data.recipient
    )
      return [];
    return [{ row, proof: proof.data }];
  });
  if (!valid.length) return { items: [], truncated: rows.length > 20 };
  const sources = await loadProvenReferenceRows(db, [
    ...new Set(valid.map(({ proof }) => proof.rfcMessageId)),
  ]);
  if (sources.length >= 101) return { items: [], truncated: true };
  const items: CampaignReply[] = [];
  for (const { row, proof } of valid) {
    const source = sources.find(
      (item) =>
        item.id === proof.reservationId &&
        item.membershipId === row.membershipId &&
        item.sequenceId === row.sequenceId &&
        item.connectionId === row.policyConnectionId,
    );
    if (!source) continue;
    const monitor = monitorScopesSchema.safeParse(source.snapshot);
    if (proof.outboundProvider === "resend" && !monitor.success) continue;
    const matches = proveReferences(
      sources.filter((item) => item.rfc === proof.rfcMessageId),
      proof.recipient,
      {
        connectionId: proof.connectionId,
        googleSubject: proof.googleSubject,
        grantEpoch: proof.grantEpoch,
        grantedScopes: monitor.success
          ? monitor.data.monitoredMailbox.grantedScopes
          : [],
      },
      row.mailboxAddress,
    );
    if (
      matches.length !== 1 ||
      matches[0]?.enrollment.id !== row.sequenceId ||
      JSON.stringify(matches[0].attribution) !== JSON.stringify(proof)
    )
      continue;
    if (
      !(row.receivedAt instanceof Date) ||
      !Number.isFinite(row.receivedAt.getTime()) ||
      row.receivedAt > now ||
      (row.reviewedMembershipId &&
        row.reviewedMembershipId !== row.membershipId)
    )
      continue;
    let review: CampaignReply["review"] = null;
    if (row.reviewedKind !== null) {
      const kind = reviewKind(row.reviewedKind);
      if (
        !kind ||
        row.reviewedMembershipId !== row.membershipId ||
        !(row.reviewedAt instanceof Date) ||
        !Number.isFinite(row.reviewedAt.getTime()) ||
        row.reviewedAt < row.receivedAt
      )
        continue;
      review = { kind, recordedAt: row.reviewedAt.toISOString() };
    } else if (row.reviewedMembershipId !== null || row.reviewedAt !== null)
      continue;
    items.push({
      messageId: row.messageId,
      membershipId: row.membershipId,
      policyVersion: row.policyVersion,
      prospectVersion: row.prospectVersion,
      contactVersion: row.contactVersion,
      receivedAt: row.receivedAt.toISOString(),
      gmailUrl: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(row.threadId)}`,
      review,
    });
  }
  return { items, truncated: rows.length > 20 };
}
