import { randomUUID } from "node:crypto";

import type { GrowthDb } from "../db/types";
import { ResendClientError, type ResendGateway } from "../integrations/resend/client";
import type { NewsletterDispatchRepository } from "./newsletter-dispatch-repository";

const LEASE_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_MAX_MESSAGES_PER_RUN = 25;
const DEFAULT_MAX_SEED_ISSUES_PER_RUN = 5;

export type NewsletterDispatchSummary = {
  seededIssues: number;
  claimed: number;
  sent: number;
  cancelled: number;
  retryableFailures: number;
  permanentFailures: number;
};

type NewsletterDispatcherDependencies = {
  repository: NewsletterDispatchRepository;
  resend: Pick<ResendGateway, "send">;
  fromEmail: string;
  replyToEmail: string;
  now?: () => Date;
  createLeaseToken?: () => string;
  maxMessagesPerRun?: number;
  maxSeedIssuesPerRun?: number;
};

/** Bounded, leased newsletter dispatcher. Recipient selection happens at
 * seed time (one `newsletter_sends` row per currently subscribed
 * subscriber); consent and suppression are rechecked in the same
 * transaction that leases each send. Never logs recipient content. */
export function createNewsletterDispatcher({
  repository,
  resend,
  fromEmail,
  replyToEmail,
  now = () => new Date(),
  createLeaseToken = () => randomUUID(),
  maxMessagesPerRun = DEFAULT_MAX_MESSAGES_PER_RUN,
  maxSeedIssuesPerRun = DEFAULT_MAX_SEED_ISSUES_PER_RUN,
}: NewsletterDispatcherDependencies) {
  return async function dispatchDueNewsletters(
    db: GrowthDb,
  ): Promise<NewsletterDispatchSummary> {
    const summary: NewsletterDispatchSummary = {
      seededIssues: 0,
      claimed: 0,
      sent: 0,
      cancelled: 0,
      retryableFailures: 0,
      permanentFailures: 0,
    };

    for (let index = 0; index < maxSeedIssuesPerRun; index += 1) {
      const seeded = await repository.seedNextDueIssue(db, now());
      if (!seeded) break;
      summary.seededIssues += 1;
    }

    for (let index = 0; index < maxMessagesPerRun; index += 1) {
      const leaseExpiresAt = new Date(now().getTime() + LEASE_DURATION_MS);
      const claimed = await repository.claimDueSend(db, {
        now: now(),
        leaseToken: createLeaseToken(),
        leaseExpiresAt,
      });
      if (!claimed) break;
      summary.claimed += 1;

      const recipient = await repository.getRecipient(
        db,
        claimed.subscriberId,
      );
      if (!recipient || recipient.status !== "subscribed") {
        await repository.cancelSend(db, {
          sendId: claimed.id,
          errorCode: "suppressed_contact",
        });
        summary.cancelled += 1;
        continue;
      }

      const issue = await repository.getIssueSnapshot(
        db,
        claimed.newsletterIssueId,
      );
      if (!issue || issue.status !== "sending") {
        await repository.cancelSend(db, {
          sendId: claimed.id,
          errorCode: "issue_not_dispatchable",
        });
        summary.cancelled += 1;
        continue;
      }

      try {
        const result = await resend.send({
          idempotencyKey: claimed.idempotencyKey,
          category: "newsletter",
          from: fromEmail,
          to: recipient.email,
          replyTo: replyToEmail,
          subject: issue.subject,
          html: issue.htmlSnapshot,
          text: issue.textSnapshot,
        });
        await repository.recordSent(db, {
          sendId: claimed.id,
          newsletterIssueId: claimed.newsletterIssueId,
          providerMessageId: result.providerMessageId,
          sentAt: now(),
        });
        summary.sent += 1;
      } catch (error) {
        if (error instanceof ResendClientError && error.retryable) {
          await repository.failSend(db, {
            sendId: claimed.id,
            status: "retry",
            errorCode: error.code,
            errorSummary: error.message,
          });
          summary.retryableFailures += 1;
        } else {
          const code = error instanceof ResendClientError ? error.code : "unknown";
          const message = error instanceof Error ? error.message : "Unknown error.";
          await repository.failSend(db, {
            sendId: claimed.id,
            status: "failed",
            errorCode: code,
            errorSummary: message,
          });
          summary.permanentFailures += 1;
        }
      }
    }

    return summary;
  };
}
