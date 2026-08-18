import { randomUUID } from "node:crypto";

import type { GrowthDb } from "../db/types";
import {
  GmailClientError,
  type GmailClient,
  type GmailMessageMetadata,
} from "../integrations/gmail/types";
import { scheduledFollowUpsForFirstSend } from "./dispatcher";
import { recordSent, type RecordSentInput } from "./dispatcher-repository";
import type { GmailSyncRepository } from "./gmail-sync-repository";
import { stopSequence as defaultStopSequence } from "./stop";
import type { StopSequenceInput, StoppedSequence } from "./stop";

export type GmailSyncSummary = {
  processed: number;
  replies: number;
  bounces: number;
  autoResponses: number;
  ownMessages: number;
  reconciledDrafts: number;
  cursorReset: boolean;
};

const BOUNCE_SENDER_PATTERN =
  /mailer-daemon|postmaster|delivery-subsystem|bounce/i;

function extractEmailAddress(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : header).trim().toLowerCase();
  return candidate || null;
}

function isBounceSender(fromAddress: string | null): boolean {
  return fromAddress !== null && BOUNCE_SENDER_PATTERN.test(fromAddress);
}

function isAutomatedResponse(metadata: GmailMessageMetadata): boolean {
  if (
    metadata.autoSubmitted &&
    metadata.autoSubmitted.trim().toLowerCase() !== "no"
  ) {
    return true;
  }
  if (
    metadata.precedence &&
    /bulk|auto_reply|list/i.test(metadata.precedence)
  ) {
    return true;
  }
  return Boolean(metadata.autoResponseSuppress);
}

function emptySummary(): GmailSyncSummary {
  return {
    processed: 0,
    replies: 0,
    bounces: 0,
    autoResponses: 0,
    ownMessages: 0,
    reconciledDrafts: 0,
    cursorReset: false,
  };
}

type GmailSyncDependencies = {
  repository: GmailSyncRepository;
  gmailClient: Pick<
    GmailClient,
    "listHistory" | "getMessageMetadata" | "getProfile"
  >;
  founderEmail: string;
  stop?: (db: GrowthDb, input: StopSequenceInput) => Promise<StoppedSequence>;
  record?: (db: GrowthDb, input: RecordSentInput) => Promise<void>;
  createCorrelationId?: () => string;
};

export function createGmailReplySync({
  repository,
  gmailClient,
  founderEmail,
  stop = defaultStopSequence,
  record = recordSent,
  createCorrelationId = () => randomUUID(),
}: GmailSyncDependencies) {
  const normalisedFounderEmail = founderEmail.trim().toLowerCase();

  return async function syncGmailReplies(
    db: GrowthDb,
  ): Promise<GmailSyncSummary> {
    const summary = emptySummary();

    const cursor = await repository.getCursor(db, founderEmail);
    if (!cursor) {
      const profile = await gmailClient.getProfile();
      await repository.setCursor(db, founderEmail, profile.historyId);
      return summary;
    }

    async function tryReconcileDraft(
      metadata: GmailMessageMetadata,
    ): Promise<void> {
      if (!metadata.rfcMessageId) return;
      const pending = await repository.findPendingDraftByRfcMessageId(
        db,
        metadata.rfcMessageId,
      );
      if (!pending) return;

      const sentAt = new Date(metadata.receivedAt);
      await record(db, {
        messageId: pending.id,
        sequenceEnrollmentId: pending.sequenceEnrollmentId,
        prospectId: pending.prospectId,
        contactId: pending.contactId,
        providerMessageId: metadata.messageId,
        providerThreadId: metadata.gmailThreadId,
        sentAt,
        rfcMessageId: metadata.rfcMessageId,
        subjectSnapshot: pending.subjectSnapshot ?? "",
        htmlSnapshot: pending.htmlSnapshot ?? "",
        textSnapshot: pending.textSnapshot ?? "",
        followUps: scheduledFollowUpsForFirstSend(
          pending.sequenceEnrollmentId,
          sentAt,
        ),
      });
      await repository.activatePendingApproval(
        db,
        pending.sequenceEnrollmentId,
      );
      summary.reconciledDrafts += 1;
    }

    async function processMessage(gmailMessageId: string): Promise<void> {
      const metadata = await gmailClient.getMessageMetadata(gmailMessageId);
      summary.processed += 1;

      const fromAddress = extractEmailAddress(metadata.from);
      if (fromAddress === normalisedFounderEmail) {
        summary.ownMessages += 1;
        await tryReconcileDraft(metadata);
        return;
      }

      const enrollment = await repository.findEnrollmentByThread(
        db,
        metadata.gmailThreadId,
      );
      if (!enrollment) return;

      const isBounce = isBounceSender(fromAddress);
      const eventType = isBounce
        ? "bounce"
        : isAutomatedResponse(metadata)
          ? "auto_response"
          : "reply";

      const recorded = await repository.recordInboundEvent(db, {
        sequenceEnrollmentId: enrollment.id,
        prospectId: enrollment.prospectId,
        contactId: enrollment.contactId,
        gmailMessageId,
        gmailThreadId: metadata.gmailThreadId,
        rfcMessageId: metadata.rfcMessageId,
        from: metadata.from,
        subject: metadata.subject,
        receivedAt: new Date(metadata.receivedAt),
        eventType,
      });
      if (recorded.alreadyRecorded) return;

      if (eventType === "auto_response") {
        summary.autoResponses += 1;
        return;
      }

      if (isBounce) {
        summary.bounces += 1;
      } else {
        summary.replies += 1;
      }
      await stop(db, {
        sequenceId: enrollment.id,
        reason: eventType,
        actor: { type: "gmail_sync", id: "gmail-sync" },
        correlationId: createCorrelationId(),
      });
    }

    const seenMessageIds = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = cursor;

    for (;;) {
      let page;
      try {
        page = await gmailClient.listHistory({
          startHistoryId: cursor,
          pageToken,
        });
      } catch (error) {
        if (
          error instanceof GmailClientError &&
          error.code === "HISTORY_ID_EXPIRED"
        ) {
          const profile = await gmailClient.getProfile();
          await repository.setCursor(db, founderEmail, profile.historyId);
          summary.cursorReset = true;
          return summary;
        }
        throw error;
      }

      for (const record_ of page.records) {
        for (const added of record_.messagesAdded) {
          if (seenMessageIds.has(added.messageId)) continue;
          seenMessageIds.add(added.messageId);
          await processMessage(added.messageId);
        }
      }

      latestHistoryId = page.historyId;
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    await repository.setCursor(db, founderEmail, latestHistoryId);
    return summary;
  };
}
