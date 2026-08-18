import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";

export type ClaimedNewsletterSend = {
  id: string;
  previousStatus: "queued" | "retry" | "sending";
  newsletterIssueId: string;
  subscriberId: string;
  idempotencyKey: string;
  attemptCount: number;
};

export type NewsletterIssueSnapshot = {
  status: string;
  subject: string;
  htmlSnapshot: string;
  textSnapshot: string;
};

export type NewsletterSendRecipient = {
  status: string;
  email: string;
};

export type RecordNewsletterSentInput = {
  sendId: string;
  newsletterIssueId: string;
  providerMessageId: string;
  sentAt: Date;
};

export type FailNewsletterSendInput = {
  sendId: string;
  status: "retry" | "failed";
  errorCode: string;
  errorSummary: string;
};

export type CancelNewsletterSendInput = {
  sendId: string;
  errorCode: string;
};

export interface NewsletterDispatchRepository {
  seedNextDueIssue(db: GrowthDb, now: Date): Promise<boolean>;
  claimDueSend(
    db: GrowthDb,
    input: { now: Date; leaseToken: string; leaseExpiresAt: Date },
  ): Promise<ClaimedNewsletterSend | null>;
  getIssueSnapshot(
    db: GrowthDb,
    newsletterIssueId: string,
  ): Promise<NewsletterIssueSnapshot | null>;
  getRecipient(
    db: GrowthDb,
    subscriberId: string,
  ): Promise<NewsletterSendRecipient | null>;
  cancelSend(db: GrowthDb, input: CancelNewsletterSendInput): Promise<void>;
  failSend(db: GrowthDb, input: FailNewsletterSendInput): Promise<void>;
  recordSent(db: GrowthDb, input: RecordNewsletterSentInput): Promise<void>;
}

/** Flips the next due (`scheduled`, `scheduled_for <= now`) issue to
 * `sending` and seeds one `newsletter_sends` row per currently subscribed
 * subscriber, atomically, so recipient selection happens at dispatch time
 * rather than from a stale audience snapshot. Returns whether an issue was
 * seeded. */
async function seedNextDueIssue(db: GrowthDb, now: Date): Promise<boolean> {
  const rows = await db<Array<{ newsletterIssueId: string }>>`
    with due_issue as (
      select id
      from growth.newsletter_issues
      where status = 'scheduled' and scheduled_for <= ${now}
      order by scheduled_for asc
      for update skip locked
      limit 1
    ),
    flipped as (
      update growth.newsletter_issues ni
      set status = 'sending', updated_at = now()
      from due_issue
      where ni.id = due_issue.id
      returning ni.id
    )
    insert into growth.newsletter_sends (
      newsletter_issue_id, subscriber_id, idempotency_key
    )
    select flipped.id, ns.id, 'newsletter:' || flipped.id || ':' || ns.id
    from flipped
    cross join growth.newsletter_subscribers ns
    where ns.status = 'subscribed'
    on conflict (newsletter_issue_id, subscriber_id) do nothing
    returning newsletter_issue_id as "newsletterIssueId"
  `;
  return rows.length > 0;
}

async function claimDueSend(
  db: GrowthDb,
  input: { now: Date; leaseToken: string; leaseExpiresAt: Date },
): Promise<ClaimedNewsletterSend | null> {
  const rows = await db<Array<ClaimedNewsletterSend>>`
    with target as (
      select s.id, s.status as "previousStatus"
      from growth.newsletter_sends s
      inner join growth.newsletter_issues i on i.id = s.newsletter_issue_id
      inner join growth.newsletter_subscribers sub on sub.id = s.subscriber_id
      where i.status = 'sending'
        and sub.status = 'subscribed'
        and (
          s.status in ('queued', 'retry')
          or (s.status = 'sending' and s.lease_expires_at < ${input.now})
        )
      order by s.created_at asc
      for update of s skip locked
      limit 1
    )
    update growth.newsletter_sends s
    set status = 'sending',
        lease_token = ${input.leaseToken},
        lease_expires_at = ${input.leaseExpiresAt},
        attempt_count = s.attempt_count + 1,
        updated_at = now()
    from target
    where s.id = target.id
    returning
      s.id,
      target."previousStatus",
      s.newsletter_issue_id as "newsletterIssueId",
      s.subscriber_id as "subscriberId",
      s.idempotency_key as "idempotencyKey",
      s.attempt_count as "attemptCount"
  `;
  return rows[0] ?? null;
}

async function getIssueSnapshot(
  db: GrowthDb,
  newsletterIssueId: string,
): Promise<NewsletterIssueSnapshot | null> {
  const rows = await db<Array<NewsletterIssueSnapshot>>`
    select status, subject,
           html_snapshot as "htmlSnapshot", text_snapshot as "textSnapshot"
    from growth.newsletter_issues
    where id = ${newsletterIssueId}
  `;
  return rows[0] ?? null;
}

async function getRecipient(
  db: GrowthDb,
  subscriberId: string,
): Promise<NewsletterSendRecipient | null> {
  const rows = await db<Array<NewsletterSendRecipient>>`
    select status, email
    from growth.newsletter_subscribers
    where id = ${subscriberId}
  `;
  return rows[0] ?? null;
}

async function cancelSend(
  db: GrowthDb,
  input: CancelNewsletterSendInput,
): Promise<void> {
  await db`
    update growth.newsletter_sends
    set status = 'cancelled',
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        updated_at = now()
    where id = ${input.sendId}
  `;
}

async function failSend(
  db: GrowthDb,
  input: FailNewsletterSendInput,
): Promise<void> {
  await db`
    update growth.newsletter_sends
    set status = ${input.status},
        lease_token = null,
        lease_expires_at = null,
        last_error_code = ${input.errorCode},
        last_error_summary = ${input.errorSummary},
        updated_at = now()
    where id = ${input.sendId}
  `;
}

async function recordSent(
  db: GrowthDb,
  input: RecordNewsletterSentInput,
): Promise<void> {
  await withGrowthTransaction(db, async (tx) => {
    await tx`
      update growth.newsletter_sends
      set status = 'sent',
          provider_message_id = ${input.providerMessageId},
          sent_at = ${input.sentAt},
          lease_token = null,
          lease_expires_at = null,
          updated_at = now()
      where id = ${input.sendId}
    `;

    const remaining = await tx<Array<{ count: string }>>`
      select count(*)::text as count
      from growth.newsletter_sends
      where newsletter_issue_id = ${input.newsletterIssueId}
        and status not in ('sent', 'cancelled', 'failed')
    `;

    if (Number(remaining[0]?.count ?? 0) === 0) {
      await tx`
        update growth.newsletter_issues
        set status = 'sent', sent_at = ${input.sentAt}, updated_at = now()
        where id = ${input.newsletterIssueId} and status = 'sending'
      `;
    }
  });
}

export const postgresNewsletterDispatchRepository: NewsletterDispatchRepository =
  {
    seedNextDueIssue,
    claimDueSend,
    getIssueSnapshot,
    getRecipient,
    cancelSend,
    failSend,
    recordSent,
  };
