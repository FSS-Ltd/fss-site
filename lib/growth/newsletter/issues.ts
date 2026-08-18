import { createHash } from "node:crypto";

import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { signUnsubscribeToken } from "../email/suppression";
import type { ResendGateway } from "../integrations/resend/client";

export type NewsletterIssueStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

const LINEAR_STATUS_ORDER: readonly NewsletterIssueStatus[] = [
  "draft",
  "ready_for_review",
  "approved",
  "scheduled",
  "sending",
  "sent",
];
const TERMINAL_STATUSES = new Set<NewsletterIssueStatus>([
  "sent",
  "failed",
  "cancelled",
]);

/**
 * Placeholder token that a newsletter issue's stored `html_snapshot`/
 * `text_snapshot` must contain wherever the recipient's real unsubscribe
 * link belongs. No issue-authoring code exists in this repo yet (Task 8 is
 * the only component here with each recipient's real email address
 * available at send time), so this literal string is the documented
 * contract: whichever future issue-authoring UI builds `html_snapshot`/
 * `text_snapshot` must emit this token, and `createFounderTestSender` /
 * `createNewsletterDispatcher` substitute it with a real, per-recipient,
 * HMAC-signed unsubscribe URL immediately before the message goes out over
 * Resend (see `renderRecipientSnapshot` below). Every occurrence in both
 * the html and text snapshot must be substituted before send.
 */
export const UNSUBSCRIBE_URL_PLACEHOLDER = "{{unsubscribe_url}}";

/** Builds a real unsubscribe URL for one recipient, matching what
 * app/api/newsletter/unsubscribe/route.ts expects (a `token` query param
 * produced by signUnsubscribeToken). */
export function buildUnsubscribeUrl(
  email: string,
  unsubscribeTokenSecret: string,
  siteOrigin: string,
): string {
  return `${siteOrigin}/api/newsletter/unsubscribe?token=${signUnsubscribeToken(email, unsubscribeTokenSecret)}`;
}

/** Substitutes every `UNSUBSCRIBE_URL_PLACEHOLDER` occurrence in a stored
 * issue snapshot with one recipient's real, working unsubscribe link. Used
 * by both the founder test sender and the scheduled dispatcher so every
 * recipient (including the founder's own test) gets a link that verifies
 * back to their own email. */
export function renderRecipientSnapshot(
  snapshot: { htmlSnapshot: string; textSnapshot: string },
  recipientEmail: string,
  unsubscribeTokenSecret: string,
  siteOrigin: string,
): { html: string; text: string; unsubscribeUrl: string } {
  const unsubscribeUrl = buildUnsubscribeUrl(
    recipientEmail,
    unsubscribeTokenSecret,
    siteOrigin,
  );
  return {
    html: snapshot.htmlSnapshot.split(UNSUBSCRIBE_URL_PLACEHOLDER).join(unsubscribeUrl),
    text: snapshot.textSnapshot.split(UNSUBSCRIBE_URL_PLACEHOLDER).join(unsubscribeUrl),
    unsubscribeUrl,
  };
}

/** draft -> ready_for_review -> approved -> scheduled -> sending -> sent,
 * with an explicit failed/cancelled escape from any non-terminal state. */
export function canTransitionNewsletterIssue(
  from: NewsletterIssueStatus,
  to: NewsletterIssueStatus,
): boolean {
  if (TERMINAL_STATUSES.has(from)) return false;
  if (to === "failed" || to === "cancelled") return true;

  const fromIndex = LINEAR_STATUS_ORDER.indexOf(from);
  const toIndex = LINEAR_STATUS_ORDER.indexOf(to);
  return fromIndex !== -1 && toIndex === fromIndex + 1;
}

/** Matches emails/render-email.ts's checksum formula so a stale approval is a
 * plain string comparison against the issue's current stored snapshot. */
export function computeIssueChecksum(html: string, text: string): string {
  return createHash("sha256").update(`\n${html}\n${text}`).digest("hex");
}

export type NewsletterIssueRow = {
  id: string;
  version: number;
  status: NewsletterIssueStatus;
  subject: string;
  htmlSnapshot: string;
  textSnapshot: string;
  testSentAt: Date | null;
  testSentVersion: number | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  approvedChecksum: string | null;
  scheduledFor: Date | null;
};

export type RecordTestSentInput = {
  issueId: string;
  version: number;
  providerMessageId: string;
  testSentAt: Date;
};

export type ApproveIssueRepositoryInput = {
  issueId: string;
  expectedVersion: number;
  approvedBy: string;
  approvedChecksum: string;
  approvedAt: Date;
};

export type ScheduleIssueRepositoryInput = {
  issueId: string;
  expectedVersion: number;
  scheduledFor: Date;
};

export interface NewsletterIssueDependencies {
  getIssueById(issueId: string): Promise<NewsletterIssueRow | null>;
  recordTestSent(input: RecordTestSentInput): Promise<void>;
  countSubscribedRecipients(): Promise<number>;
  approveIssue(
    input: ApproveIssueRepositoryInput,
  ): Promise<NewsletterIssueRow | null>;
  scheduleIssue(
    input: ScheduleIssueRepositoryInput,
  ): Promise<NewsletterIssueRow | null>;
}

export type NewsletterIssueErrorCode =
  | "not_found"
  | "not_testable"
  | "send_failed"
  | "invalid_transition"
  | "version_conflict"
  | "checksum_mismatch"
  | "test_not_sent"
  | "missing_consent"
  | "missing_unsubscribe_link"
  | "invalid_schedule_time";

export class NewsletterIssueError extends Error {
  constructor(readonly code: NewsletterIssueErrorCode) {
    super("The newsletter issue action could not be completed.");
    this.name = "NewsletterIssueError";
  }
}

async function requireIssue(
  repository: NewsletterIssueDependencies,
  issueId: string,
): Promise<NewsletterIssueRow> {
  const issue = await repository.getIssueById(issueId);
  if (!issue) throw new NewsletterIssueError("not_found");
  return issue;
}

// --- Founder test sending -------------------------------------------------

export type SendFounderTestInput = {
  issueId: string;
  founder: FounderSession;
  correlationId: string;
};

export type FounderTestResult = {
  issueId: string;
  providerMessageId: string;
  testSentAt: string;
};

export type FounderTestSenderDependencies = {
  repository: NewsletterIssueDependencies;
  resend: Pick<ResendGateway, "send">;
  fromEmail: string;
  founderEmail: string;
  unsubscribeTokenSecret: string;
  siteOrigin: string;
  now?: () => Date;
};

/** Sends the issue's pending html/text snapshot to the founder address only,
 * with the unsubscribe placeholder substituted for a real, working link
 * addressed to the founder. Never touches subscriber state. */
export function createFounderTestSender(deps: FounderTestSenderDependencies) {
  const now = deps.now ?? (() => new Date());

  return async function sendFounderTest(
    db: GrowthDb,
    input: SendFounderTestInput,
  ): Promise<FounderTestResult> {
    const issue = await requireIssue(deps.repository, input.issueId);
    if (TERMINAL_STATUSES.has(issue.status)) {
      throw new NewsletterIssueError("not_testable");
    }

    const { html, text } = renderRecipientSnapshot(
      issue,
      deps.founderEmail,
      deps.unsubscribeTokenSecret,
      deps.siteOrigin,
    );

    let sent: { providerMessageId: string };
    try {
      sent = await deps.resend.send({
        idempotencyKey: `newsletter-test:${issue.id}:${issue.version}:${now().getTime()}`,
        category: "newsletter",
        from: deps.fromEmail,
        to: deps.founderEmail,
        replyTo: deps.founderEmail,
        subject: issue.subject,
        html,
        text,
      });
    } catch {
      throw new NewsletterIssueError("send_failed");
    }

    const testSentAt = now();
    await deps.repository.recordTestSent({
      issueId: issue.id,
      version: issue.version,
      providerMessageId: sent.providerMessageId,
      testSentAt,
    });
    await appendAuditEvent(db, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.founder.actorId,
      action: "newsletter_issue.test_sent",
      entityType: "newsletter_issue",
      entityId: issue.id,
    });

    return {
      issueId: issue.id,
      providerMessageId: sent.providerMessageId,
      testSentAt: testSentAt.toISOString(),
    };
  };
}

// --- Approval --------------------------------------------------------------

export type ApproveIssueInput = {
  issueId: string;
  expectedVersion: number;
  founder: FounderSession;
  correlationId: string;
};

export type IssueApproverDependencies = {
  repository: NewsletterIssueDependencies;
  now?: () => Date;
};

/** Stores the immutable render checksum of the current snapshot and the
 * founder actor id. Requires the issue to be ready_for_review. */
export function createIssueApprover(deps: IssueApproverDependencies) {
  const now = deps.now ?? (() => new Date());

  return async function approveIssue(
    db: GrowthDb,
    input: ApproveIssueInput,
  ): Promise<NewsletterIssueRow> {
    const issue = await requireIssue(deps.repository, input.issueId);
    if (!canTransitionNewsletterIssue(issue.status, "approved")) {
      throw new NewsletterIssueError("invalid_transition");
    }
    if (issue.version !== input.expectedVersion) {
      throw new NewsletterIssueError("version_conflict");
    }

    const approvedAt = now();
    const updated = await deps.repository.approveIssue({
      issueId: issue.id,
      expectedVersion: input.expectedVersion,
      approvedBy: input.founder.actorId,
      approvedChecksum: computeIssueChecksum(
        issue.htmlSnapshot,
        issue.textSnapshot,
      ),
      approvedAt,
    });
    if (!updated) throw new NewsletterIssueError("version_conflict");

    await appendAuditEvent(db, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.founder.actorId,
      action: "newsletter_issue.approved",
      entityType: "newsletter_issue",
      entityId: issue.id,
    });

    return updated;
  };
}

// --- Scheduling --------------------------------------------------------------

export type ScheduleIssueInput = {
  issueId: string;
  expectedVersion: number;
  scheduledFor: Date;
  founder: FounderSession;
  correlationId: string;
};

export type IssueSchedulerDependencies = {
  repository: NewsletterIssueDependencies;
  now?: () => Date;
};

/** Transitions approved -> scheduled. Blocks on a stale version, a stale or
 * missing founder test, no currently consented recipients, a snapshot with
 * no unsubscribe link, a stale approval checksum, or a non-future time. */
export function createIssueScheduler(deps: IssueSchedulerDependencies) {
  const now = deps.now ?? (() => new Date());

  return async function scheduleIssue(
    db: GrowthDb,
    input: ScheduleIssueInput,
  ): Promise<NewsletterIssueRow> {
    const issue = await requireIssue(deps.repository, input.issueId);
    if (!canTransitionNewsletterIssue(issue.status, "scheduled")) {
      throw new NewsletterIssueError("invalid_transition");
    }
    if (issue.version !== input.expectedVersion) {
      throw new NewsletterIssueError("version_conflict");
    }
    if (input.scheduledFor.getTime() <= now().getTime()) {
      throw new NewsletterIssueError("invalid_schedule_time");
    }
    if (issue.testSentVersion !== issue.version) {
      throw new NewsletterIssueError("test_not_sent");
    }
    if (
      !issue.approvedChecksum ||
      issue.approvedChecksum !==
        computeIssueChecksum(issue.htmlSnapshot, issue.textSnapshot)
    ) {
      throw new NewsletterIssueError("checksum_mismatch");
    }
    if (
      !issue.htmlSnapshot.includes(UNSUBSCRIBE_URL_PLACEHOLDER) ||
      !issue.textSnapshot.includes(UNSUBSCRIBE_URL_PLACEHOLDER)
    ) {
      throw new NewsletterIssueError("missing_unsubscribe_link");
    }
    if ((await deps.repository.countSubscribedRecipients()) === 0) {
      throw new NewsletterIssueError("missing_consent");
    }

    const updated = await deps.repository.scheduleIssue({
      issueId: issue.id,
      expectedVersion: input.expectedVersion,
      scheduledFor: input.scheduledFor,
    });
    if (!updated) throw new NewsletterIssueError("version_conflict");

    await appendAuditEvent(db, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.founder.actorId,
      action: "newsletter_issue.scheduled",
      entityType: "newsletter_issue",
      entityId: issue.id,
    });

    return updated;
  };
}

// --- Combined approve + schedule (single founder action) -------------------

export type ApproveAndScheduleInput = {
  issueId: string;
  expectedVersion: number;
  scheduledFor: Date;
  founder: FounderSession;
  correlationId: string;
};

export type IssueApproveAndSchedulerDependencies = {
  repository: NewsletterIssueDependencies;
  now?: () => Date;
};

/** The founder's single "Approve & Schedule" action: approves first when the
 * issue is still ready_for_review, then schedules. If the issue was already
 * approved, scheduling runs directly. */
export function createIssueApproveAndScheduler(
  deps: IssueApproveAndSchedulerDependencies,
) {
  const approve = createIssueApprover(deps);
  const schedule = createIssueScheduler(deps);

  return async function approveAndSchedule(
    db: GrowthDb,
    input: ApproveAndScheduleInput,
  ): Promise<NewsletterIssueRow> {
    const issue = await requireIssue(deps.repository, input.issueId);

    if (issue.status === "ready_for_review") {
      await approve(db, {
        issueId: input.issueId,
        expectedVersion: input.expectedVersion,
        founder: input.founder,
        correlationId: input.correlationId,
      });
    }

    return schedule(db, {
      issueId: input.issueId,
      expectedVersion: input.expectedVersion,
      scheduledFor: input.scheduledFor,
      founder: input.founder,
      correlationId: input.correlationId,
    });
  };
}

// --- Postgres-backed dependencies -------------------------------------------

type NewsletterIssueRowSql = {
  id: string;
  version: number;
  status: NewsletterIssueStatus;
  subject: string;
  htmlSnapshot: string;
  textSnapshot: string;
  testSentAt: Date | null;
  testSentVersion: number | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  approvedChecksum: string | null;
  scheduledFor: Date | null;
};

export function createPostgresNewsletterIssueDependencies(
  db: GrowthDb,
): NewsletterIssueDependencies {
  return {
    async getIssueById(issueId) {
      const rows = await db<NewsletterIssueRowSql[]>`
        select id, version, status, subject,
               html_snapshot as "htmlSnapshot", text_snapshot as "textSnapshot",
               test_sent_at as "testSentAt", test_sent_version as "testSentVersion",
               approved_at as "approvedAt", approved_by as "approvedBy",
               approved_checksum as "approvedChecksum", scheduled_for as "scheduledFor"
        from growth.newsletter_issues
        where id = ${issueId}
      `;
      return rows[0] ?? null;
    },
    async recordTestSent(input) {
      await db`
        update growth.newsletter_issues
        set test_sent_at = ${input.testSentAt},
            test_sent_version = ${input.version},
            updated_at = now()
        where id = ${input.issueId}
      `;
    },
    async countSubscribedRecipients() {
      const rows = await db<{ count: string }[]>`
        select count(*)::text as count
        from growth.newsletter_subscribers
        where status = 'subscribed'
      `;
      return Number(rows[0]?.count ?? 0);
    },
    async approveIssue(input) {
      const rows = await db<NewsletterIssueRowSql[]>`
        update growth.newsletter_issues
        set status = 'approved',
            approved_at = ${input.approvedAt},
            approved_by = ${input.approvedBy},
            approved_checksum = ${input.approvedChecksum},
            updated_at = now()
        where id = ${input.issueId}
          and version = ${input.expectedVersion}
          and status = 'ready_for_review'
        returning id, version, status, subject,
               html_snapshot as "htmlSnapshot", text_snapshot as "textSnapshot",
               test_sent_at as "testSentAt", test_sent_version as "testSentVersion",
               approved_at as "approvedAt", approved_by as "approvedBy",
               approved_checksum as "approvedChecksum", scheduled_for as "scheduledFor"
      `;
      return rows[0] ?? null;
    },
    async scheduleIssue(input) {
      const rows = await db<NewsletterIssueRowSql[]>`
        update growth.newsletter_issues
        set status = 'scheduled',
            scheduled_for = ${input.scheduledFor},
            updated_at = now()
        where id = ${input.issueId}
          and version = ${input.expectedVersion}
          and status = 'approved'
        returning id, version, status, subject,
               html_snapshot as "htmlSnapshot", text_snapshot as "textSnapshot",
               test_sent_at as "testSentAt", test_sent_version as "testSentVersion",
               approved_at as "approvedAt", approved_by as "approvedBy",
               approved_checksum as "approvedChecksum", scheduled_for as "scheduledFor"
      `;
      return rows[0] ?? null;
    },
  };
}
