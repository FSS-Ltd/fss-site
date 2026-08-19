import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthQueryExecutor } from "../db/types";

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
  newsletterIssueId: string;
  status: "retry" | "failed";
  errorCode: string;
  errorSummary: string;
};

export type CancelNewsletterSendInput = {
  sendId: string;
  newsletterIssueId: string;
  errorCode: string;
};

export type CancelQueuedSendsForEmailResult = { cancelledIssueIds: string[] };

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
  cancelQueuedSendsForEmail(
    db: GrowthDb,
    normalisedEmail: string,
    errorCode: string,
  ): Promise<CancelQueuedSendsForEmailResult>;
}

/** Flips the next due (`scheduled`, `scheduled_for <= now`) issue to
 * `sending` and seeds one `newsletter_sends` row per currently subscribed
 * subscriber, so recipient selection happens at dispatch time rather than
 * from a stale audience snapshot. Runs in a transaction so the row lock from
 * `for update skip locked` holds across the flip, the seed insert, and the
 * empty-seed reconciliation below. Returns whether an issue was seeded (i.e.
 * whether one was flipped, regardless of how many sends it got). */
async function seedNextDueIssue(db: GrowthDb, now: Date): Promise<boolean> {
  return withGrowthTransaction(db, async (tx) => {
    const due = await tx<Array<{ id: string }>>`
      select id
      from growth.newsletter_issues
      where status = 'scheduled' and scheduled_for <= ${now}
      order by scheduled_for asc
      for update skip locked
      limit 1
    `;
    const issueId = due[0]?.id;
    if (!issueId) return false;

    await tx`
      update growth.newsletter_issues
      set status = 'sending', updated_at = now()
      where id = ${issueId}
    `;

    const inserted = await tx<Array<{ newsletterIssueId: string }>>`
      insert into growth.newsletter_sends (
        newsletter_issue_id, subscriber_id, idempotency_key
      )
      select ${issueId}, ns.id, 'newsletter:' || ${issueId} || ':' || ns.id
      from growth.newsletter_subscribers ns
      where ns.status = 'subscribed'
      on conflict (newsletter_issue_id, subscriber_id) do nothing
      returning newsletter_issue_id as "newsletterIssueId"
    `;

    // The last subscriber may have unsubscribed between schedule time and
    // dispatch time, leaving zero sends for the just-flipped issue with
    // nothing left to ever complete it. Resolve it immediately.
    if (inserted.length === 0) {
      await reconcileIssueCompletion(tx, issueId, now);
    }

    return true;
  });
}

/** If no non-terminal `newsletter_sends` rows remain for an issue, resolves
 * the issue out of `sending`: to `sent` if at least one send reached `sent`,
 * otherwise to `failed` (every send ended cancelled/failed, or there were
 * none at all). Guarded by `status = 'sending'` so it is a no-op if the
 * issue already moved on. Must run inside the same transaction as the send
 * update that may have made this issue's sends complete. */
export async function reconcileIssueCompletion(
  tx: GrowthQueryExecutor,
  newsletterIssueId: string,
  now: Date,
): Promise<void> {
  const remaining = await tx<Array<{ count: string }>>`
    select count(*)::text as count
    from growth.newsletter_sends
    where newsletter_issue_id = ${newsletterIssueId}
      and status not in ('sent', 'cancelled', 'failed')
  `;
  if (Number(remaining[0]?.count ?? 0) > 0) return;

  const anySent = await tx<Array<{ exists: boolean }>>`
    select exists(
      select 1 from growth.newsletter_sends
      where newsletter_issue_id = ${newsletterIssueId} and status = 'sent'
    ) as "exists"
  `;

  if (anySent[0]?.exists) {
    await tx`
      update growth.newsletter_issues
      set status = 'sent', sent_at = ${now}, updated_at = now()
      where id = ${newsletterIssueId} and status = 'sending'
    `;
  } else {
    await tx`
      update growth.newsletter_issues
      set status = 'failed', updated_at = now()
      where id = ${newsletterIssueId} and status = 'sending'
    `;
  }
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
  await withGrowthTransaction(db, async (tx) => {
    await tx`
      update growth.newsletter_sends
      set status = 'cancelled',
          lease_token = null,
          lease_expires_at = null,
          last_error_code = ${input.errorCode},
          updated_at = now()
      where id = ${input.sendId}
    `;

    await reconcileIssueCompletion(tx, input.newsletterIssueId, new Date());
  });
}

async function failSend(
  db: GrowthDb,
  input: FailNewsletterSendInput,
): Promise<void> {
  await withGrowthTransaction(db, async (tx) => {
    await tx`
      update growth.newsletter_sends
      set status = ${input.status},
          lease_token = null,
          lease_expires_at = null,
          last_error_code = ${input.errorCode},
          last_error_summary = ${input.errorSummary},
          updated_at = now()
      where id = ${input.sendId}
    `;

    await reconcileIssueCompletion(tx, input.newsletterIssueId, new Date());
  });
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

    await reconcileIssueCompletion(tx, input.newsletterIssueId, input.sentAt);
  });
}

/** Cancels every queued/retry `newsletter_sends` row for an email address,
 * across all issues, when a Resend webhook reports a hard bounce or
 * complaint for that recipient. */
async function cancelQueuedSendsForEmail(
  db: GrowthDb,
  normalisedEmail: string,
  errorCode: string,
): Promise<CancelQueuedSendsForEmailResult> {
  return withGrowthTransaction(db, async (tx) => {
    const rows = await tx<Array<{ id: string; newsletterIssueId: string }>>`
      update growth.newsletter_sends s
      set status = 'cancelled', lease_token = null, lease_expires_at = null,
          last_error_code = ${errorCode}, updated_at = now()
      from growth.newsletter_subscribers sub
      where s.subscriber_id = sub.id
        and sub.normalised_email = ${normalisedEmail}
        and s.status in ('queued', 'retry')
      returning s.id, s.newsletter_issue_id as "newsletterIssueId"
    `;
    const issueIds = [...new Set(rows.map((r) => r.newsletterIssueId))];
    for (const issueId of issueIds) {
      await reconcileIssueCompletion(tx, issueId, new Date());
    }
    return { cancelledIssueIds: issueIds };
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
    cancelQueuedSendsForEmail,
  };
