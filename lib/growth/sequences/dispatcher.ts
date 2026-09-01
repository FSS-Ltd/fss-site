import { randomUUID } from "node:crypto";

import type { GrowthDb } from "../db/types";
import { renderGmailMime } from "../email/gmail/mime";
import { renderPublishedFollowUpContent } from "../email/gmail/render";
import type { GmailClient } from "../integrations/gmail/types";
import { GmailClientError } from "../integrations/gmail/types";
import type {
  ClaimedMessage,
  SendContext,
  SequenceDispatchRepository,
} from "./dispatcher-repository";
import {
  AUTOMATED_FOLLOW_UP_LABELS,
  type FollowUpLabel,
  scheduleFollowUps,
} from "./schedule";

const LEASE_DURATION_MS = 5 * 60 * 1000;
const DEFAULT_MAX_MESSAGES_PER_RUN = 25;

const FOLLOW_UP_TEMPLATE_KEY_BY_STEP: Record<number, string> = {
  1: "gmail_follow_up_day_5",
  // The original published key is retained while its send date moves to Day 14.
  3: "gmail_follow_up_day_20",
};
const STEP_BY_FOLLOW_UP_LABEL: Record<FollowUpLabel, number> = {
  day_5: 1,
  day_11: 2,
  day_14: 3,
};

export type DispatchSummary = {
  claimed: number;
  sent: number;
  cancelled: number;
  reconciled: number;
  retryableFailures: number;
  permanentFailures: number;
};

function followUpIdempotencyKey(
  sequenceEnrollmentId: string,
  stepNumber: number,
): string {
  return `follow_up:${stepNumber}:${sequenceEnrollmentId}`;
}

export function scheduledFollowUpsForFirstSend(
  sequenceEnrollmentId: string,
  sentAt: Date,
) {
  const scheduled = scheduleFollowUps(sentAt);
  return AUTOMATED_FOLLOW_UP_LABELS.map((label) => {
    const stepNumber = STEP_BY_FOLLOW_UP_LABEL[label];
    return {
      stepNumber,
      scheduledFor: scheduled[label],
      idempotencyKey: followUpIdempotencyKey(sequenceEnrollmentId, stepNumber),
    };
  });
}

type PreparedSend = {
  raw: string;
  gmailThreadId: string | undefined;
  rfcMessageId: string;
  subject: string;
  html: string;
  text: string;
};

type PrepareOutcome =
  | { kind: "ready"; send: PreparedSend }
  | { kind: "cancel"; errorCode: string }
  | { kind: "permanent_failure"; errorCode: string; errorSummary: string };

async function prepareFirstEmailSend(
  claimed: ClaimedMessage,
  context: SendContext,
  founderEmail: string,
): Promise<PrepareOutcome> {
  if (
    !claimed.subjectSnapshot ||
    !claimed.htmlSnapshot ||
    !claimed.textSnapshot
  ) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_snapshot",
      errorSummary: "The first-email snapshot is incomplete.",
    };
  }

  const rendered = renderGmailMime({
    id: claimed.id,
    from: founderEmail,
    to: context.contactEmail,
    replyTo: founderEmail,
    subject: claimed.subjectSnapshot,
    html: claimed.htmlSnapshot,
    text: claimed.textSnapshot,
  });

  return {
    kind: "ready",
    send: {
      raw: rendered.raw,
      gmailThreadId: undefined,
      rfcMessageId: rendered.rfcMessageId,
      subject: claimed.subjectSnapshot,
      html: claimed.htmlSnapshot,
      text: claimed.textSnapshot,
    },
  };
}

async function prepareFollowUpSend(
  db: GrowthDb,
  repository: SequenceDispatchRepository,
  claimed: ClaimedMessage,
  context: SendContext,
  founderEmail: string,
): Promise<PrepareOutcome> {
  const firstName = context.firstName.trim();
  const businessName = context.businessName.trim();
  if (!firstName || !businessName) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_merge_field",
      errorSummary: "A required follow-up merge field is missing.",
    };
  }

  if (!context.gmailThreadId) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_thread",
      errorSummary: "The Gmail thread for this sequence is unknown.",
    };
  }

  const references = await repository.getThreadReferences(
    db,
    claimed.sequenceEnrollmentId,
  );
  if (!references.parentMessageId) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_thread",
      errorSummary: "No prior sent message exists to reply to.",
    };
  }

  const firstEmailSubject = context.firstEmailSubject;
  if (!firstEmailSubject) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_thread",
      errorSummary: "The original subject line is unknown.",
    };
  }

  // The second follow-up is a stored, founder-approved SEO/AEO audit draft.
  // It is never rendered from a shared template.
  if (claimed.stepNumber === 2) {
    if (
      !claimed.subjectSnapshot ||
      !claimed.htmlSnapshot ||
      !claimed.textSnapshot
    ) {
      return {
        kind: "permanent_failure",
        errorCode: "missing_snapshot",
        errorSummary: "The approved SEO audit email snapshot is incomplete.",
      };
    }
    const rendered = renderGmailMime({
      id: claimed.id,
      from: founderEmail,
      to: context.contactEmail,
      replyTo: founderEmail,
      subject: claimed.subjectSnapshot,
      html: claimed.htmlSnapshot,
      text: claimed.textSnapshot,
      thread: {
        gmailThreadId: context.gmailThreadId,
        parentMessageId: references.parentMessageId,
        references: references.references,
      },
    });
    return {
      kind: "ready",
      send: {
        raw: rendered.raw,
        gmailThreadId: rendered.gmailThreadId,
        rfcMessageId: rendered.rfcMessageId,
        subject: claimed.subjectSnapshot,
        html: claimed.htmlSnapshot,
        text: claimed.textSnapshot,
      },
    };
  }

  const templateKey = FOLLOW_UP_TEMPLATE_KEY_BY_STEP[claimed.stepNumber];
  const template = templateKey
    ? await repository.getFollowUpTemplate(db, templateKey)
    : null;
  if (!template) {
    return {
      kind: "permanent_failure",
      errorCode: "missing_template",
      errorSummary: "The published follow-up template could not be found.",
    };
  }

  const content = renderPublishedFollowUpContent({
    subject: firstEmailSubject,
    snapshot: {
      status: "published",
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
      requiredFields: ["firstName", "businessName"],
    },
    mergeFields: { firstName, businessName },
  });
  const rendered = renderGmailMime({
    id: claimed.id,
    from: founderEmail,
    to: context.contactEmail,
    replyTo: founderEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    thread: {
      gmailThreadId: context.gmailThreadId,
      parentMessageId: references.parentMessageId,
      references: references.references,
    },
  });

  return {
    kind: "ready",
    send: {
      raw: rendered.raw,
      gmailThreadId: rendered.gmailThreadId,
      rfcMessageId: rendered.rfcMessageId,
      subject: content.subject,
      html: content.html,
      text: content.text,
    },
  };
}

type OutreachDispatcherDependencies = {
  repository: SequenceDispatchRepository;
  gmailClient: Pick<GmailClient, "sendMessage" | "findByRfcMessageId">;
  founderEmail: string;
  now?: () => Date;
  createLeaseToken?: () => string;
  maxMessagesPerRun?: number;
};

export function createOutreachDispatcher({
  repository,
  gmailClient,
  founderEmail,
  now = () => new Date(),
  createLeaseToken = () => randomUUID(),
  maxMessagesPerRun = DEFAULT_MAX_MESSAGES_PER_RUN,
}: OutreachDispatcherDependencies) {
  return async function dispatchDueOutreach(
    db: GrowthDb,
    dispatchAt: Date,
  ): Promise<DispatchSummary> {
    const summary: DispatchSummary = {
      claimed: 0,
      sent: 0,
      cancelled: 0,
      reconciled: 0,
      retryableFailures: 0,
      permanentFailures: 0,
    };

    for (let index = 0; index < maxMessagesPerRun; index += 1) {
      const leaseExpiresAt = new Date(now().getTime() + LEASE_DURATION_MS);
      const claimed = await repository.claimDueMessage(db, {
        now: dispatchAt,
        leaseToken: createLeaseToken(),
        leaseExpiresAt,
      });
      if (!claimed) break;
      summary.claimed += 1;

      const context = await repository.getSendContext(
        db,
        claimed.sequenceEnrollmentId,
      );
      if (!context || context.enrollmentStatus !== "active") {
        await repository.cancelMessage(db, {
          messageId: claimed.id,
          errorCode: "enrollment_not_active",
        });
        summary.cancelled += 1;
        continue;
      }
      if (await repository.isSuppressed(db, context.normalisedEmail)) {
        await repository.cancelMessage(db, {
          messageId: claimed.id,
          errorCode: "suppressed_contact",
        });
        summary.cancelled += 1;
        continue;
      }
      if (
        await repository.hasNewerInboundMessage(
          db,
          claimed.sequenceEnrollmentId,
        )
      ) {
        await repository.cancelMessage(db, {
          messageId: claimed.id,
          errorCode: "reply_detected",
        });
        summary.cancelled += 1;
        continue;
      }

      if (claimed.previousStatus !== "queued" && claimed.rfcMessageId) {
        const reconciled = await gmailClient.findByRfcMessageId(
          claimed.rfcMessageId,
        );
        if (reconciled) {
          await recordReconciledSent(repository, db, claimed, reconciled);
          summary.reconciled += 1;
          continue;
        }
      }

      const prepared =
        claimed.stepNumber === 0
          ? await prepareFirstEmailSend(claimed, context, founderEmail)
          : await prepareFollowUpSend(
              db,
              repository,
              claimed,
              context,
              founderEmail,
            );

      if (prepared.kind === "cancel") {
        await repository.cancelMessage(db, {
          messageId: claimed.id,
          errorCode: prepared.errorCode,
        });
        summary.cancelled += 1;
        continue;
      }
      if (prepared.kind === "permanent_failure") {
        await repository.failMessage(db, {
          messageId: claimed.id,
          status: "failed",
          errorCode: prepared.errorCode,
          errorSummary: prepared.errorSummary,
        });
        summary.permanentFailures += 1;
        continue;
      }

      try {
        const result = await gmailClient.sendMessage({
          raw: prepared.send.raw,
          gmailThreadId: prepared.send.gmailThreadId,
        });
        await repository.recordSent(db, {
          messageId: claimed.id,
          sequenceEnrollmentId: claimed.sequenceEnrollmentId,
          prospectId: claimed.prospectId,
          contactId: claimed.contactId,
          providerMessageId: result.messageId,
          providerThreadId: result.gmailThreadId,
          sentAt: now(),
          rfcMessageId: prepared.send.rfcMessageId,
          subjectSnapshot: prepared.send.subject,
          htmlSnapshot: prepared.send.html,
          textSnapshot: prepared.send.text,
          followUps:
            claimed.stepNumber === 0
              ? scheduledFollowUpsForFirstSend(
                  claimed.sequenceEnrollmentId,
                  now(),
                )
              : null,
        });
        summary.sent += 1;
      } catch (error) {
        if (error instanceof GmailClientError && error.retryable) {
          await repository.failMessage(db, {
            messageId: claimed.id,
            status: "retry",
            errorCode: error.code,
            errorSummary: error.message,
          });
          summary.retryableFailures += 1;
        } else {
          const code =
            error instanceof GmailClientError ? error.code : "unknown";
          const message =
            error instanceof Error ? error.message : "Unknown error.";
          await repository.failMessage(db, {
            messageId: claimed.id,
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

async function recordReconciledSent(
  repository: SequenceDispatchRepository,
  db: GrowthDb,
  claimed: ClaimedMessage,
  reconciled: { messageId: string; gmailThreadId: string },
): Promise<void> {
  await repository.recordSent(db, {
    messageId: claimed.id,
    sequenceEnrollmentId: claimed.sequenceEnrollmentId,
    prospectId: claimed.prospectId,
    contactId: claimed.contactId,
    providerMessageId: reconciled.messageId,
    providerThreadId: reconciled.gmailThreadId,
    sentAt: new Date(),
    rfcMessageId: claimed.rfcMessageId ?? "",
    subjectSnapshot: claimed.subjectSnapshot ?? "",
    htmlSnapshot: claimed.htmlSnapshot ?? "",
    textSnapshot: claimed.textSnapshot ?? "",
    followUps:
      claimed.stepNumber === 0
        ? scheduledFollowUpsForFirstSend(
            claimed.sequenceEnrollmentId,
            new Date(),
          )
        : null,
  });
}
