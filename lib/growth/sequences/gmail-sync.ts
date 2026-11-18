import { randomUUID } from "node:crypto";

import type { GrowthDb } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import {
  GmailClientError,
  type GmailClient,
  type GmailMessageMetadata,
} from "../integrations/gmail/types";
import type { GmailSyncRepository } from "./gmail-sync-repository";
import { stopSequence as defaultStopSequence, SequenceStopError } from "./stop";
import type { StopSequenceInput, StoppedSequence } from "./stop";
import { GmailThreadAttributionChangedError } from "./gmail-thread-association";

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
  binding: GmailGrantBinding;
  stop?: (db: GrowthDb, input: StopSequenceInput) => Promise<StoppedSequence>;
  createCorrelationId?: () => string;
  now?: () => Date;
};

export function createGmailReplySync({
  repository,
  gmailClient,
  founderEmail,
  binding,
  stop = defaultStopSequence,
  createCorrelationId = () => randomUUID(),
  now = () => new Date(),
}: GmailSyncDependencies) {
  const normalisedFounderEmail = founderEmail.trim().toLowerCase();

  return async function syncGmailReplies(
    db: GrowthDb,
  ): Promise<GmailSyncSummary> {
    const summary = emptySummary();

    const state = await repository.loadReplySyncState(db, binding);
    const headRequestStarted = now();
    const profile = await gmailClient.getProfile();
    const headResponseEnded = now();
    if (
      profile.emailAddress.trim().toLowerCase() !== normalisedFounderEmail ||
      !/^\d{1,32}$/.test(profile.historyId)
    )
      throw new Error("Gmail profile identity or history is invalid.");
    if (!state.coverageId || !state.observedUntil || !state.historyCursor) {
      await repository.commitReplyCoverage(db, {
        binding,
        expectedCursor: state.cursor,
        expectedCoverageId: state.coverageId,
        expectedObservedUntil: state.observedUntil,
        historyStart: null,
        historyEnd: profile.historyId,
        observedFrom: null,
        observedUntil: headResponseEnded,
        headRequestedAt: headRequestStarted,
        headRespondedAt: headResponseEnded,
        state: "gap",
        reason: "initial_history_unknown",
        unknownObservations: [],
      });
      return summary;
    }
    const cursor = state.historyCursor;
    if (!/^\d{1,32}$/.test(cursor))
      throw new Error("Gmail history boundary is invalid.");
    if (
      BigInt(profile.historyId) < BigInt(cursor) ||
      headRequestStarted <= state.observedUntil
    )
      throw new Error("Gmail history boundary is invalid.");

    let gapReason: string | null = null;
    const unknownObservations: Array<{ messageId: string; reason: string }> =
      [];
    function recordUnknown(messageId: string, reason: string): void {
      if (unknownObservations.length >= 1000)
        throw new Error("Gmail unknown observation limit exceeded.");
      unknownObservations.push({ messageId, reason });
      gapReason = reason;
    }
    async function observePendingDraft(
      metadata: GmailMessageMetadata,
    ): Promise<void> {
      if (!metadata.rfcMessageId) return;
      const pending = await repository.findPendingDraftByRfcMessageId(
        db,
        metadata.rfcMessageId,
      );
      if (pending)
        recordUnknown(metadata.messageId, "unbound_draft_observation");
    }

    async function processMessage(
      gmailMessageId: string,
      gmailThreadId: string,
      recordHistoryId: string,
    ): Promise<void> {
      const metadata = await gmailClient.getMessageMetadata(gmailMessageId);
      if (
        metadata.messageId !== gmailMessageId ||
        metadata.gmailThreadId !== gmailThreadId ||
        !/^\d{1,32}$/.test(metadata.historyId) ||
        BigInt(metadata.historyId) < BigInt(recordHistoryId) ||
        BigInt(metadata.historyId) > BigInt(profile.historyId)
      )
        throw new Error("Gmail metadata history is inconsistent.");
      summary.processed += 1;

      const fromAddress = extractEmailAddress(metadata.from);
      if (
        fromAddress === normalisedFounderEmail ||
        metadata.labelIds.includes("SENT")
      ) {
        summary.ownMessages += 1;
        if (metadata.labelIds.includes("SENT"))
          await observePendingDraft(metadata);
        return;
      }

      const match = await repository.findEnrollmentByThread(
        db,
        metadata.gmailThreadId,
        binding,
      );
      if (match.kind === "none") return;
      if (match.kind === "ambiguous") {
        recordUnknown(gmailMessageId, "ambiguous_account_thread");
        return;
      }
      const enrollment = match.enrollment;
      if (match.kind === "unknown") {
        recordUnknown(gmailMessageId, "unknown_account_thread");
        if (
          match.safeToPause &&
          !enrollment.status.startsWith("stopped_") &&
          enrollment.status !== "completed"
        ) {
          try {
            await stop(db, {
              sequenceId: enrollment.id,
              reason: "pause",
              actor: { type: "gmail_sync", id: "gmail-sync", binding },
              gmailThreadId: metadata.gmailThreadId,
              correlationId: createCorrelationId(),
            });
          } catch (error) {
            if (
              !(error instanceof GmailThreadAttributionChangedError) &&
              !(
                error instanceof SequenceStopError &&
                error.code === "already_stopped"
              )
            )
              throw error;
          }
        }
        return;
      }

      const isBounce = isBounceSender(fromAddress);
      const eventType = isBounce
        ? "bounce"
        : isAutomatedResponse(metadata)
          ? "auto_response"
          : "reply";

      const recorded = await repository.recordInboundEvent(db, {
        binding,
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
        correlationId: createCorrelationId(),
      });
      if (recorded.attributionUnknown) {
        recordUnknown(gmailMessageId, "ambiguous_account_thread");
        return;
      }
      if (eventType === "auto_response") {
        if (!recorded.alreadyRecorded) summary.autoResponses += 1;
        return;
      }

      if (!recorded.alreadyRecorded) {
        if (isBounce) {
          summary.bounces += 1;
        } else {
          summary.replies += 1;
        }
      }
    }

    const seenMessageIds = new Set<string>();
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = cursor;
    let deleted = false;
    let pageCount = 0;
    let lastRecord = BigInt(cursor);

    for (;;) {
      if (++pageCount > 20)
        throw new Error("Gmail history page limit exceeded.");
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
          await repository.commitReplyCoverage(db, {
            binding,
            expectedCursor: state.cursor,
            expectedCoverageId: state.coverageId,
            expectedObservedUntil: state.observedUntil,
            historyStart: cursor,
            historyEnd: profile.historyId,
            observedFrom: state.observedUntil,
            observedUntil: headResponseEnded,
            headRequestedAt: headRequestStarted,
            headRespondedAt: headResponseEnded,
            state: "gap",
            reason: "history_expired",
            unknownObservations: [],
          });
          summary.cursorReset = true;
          return summary;
        }
        throw error;
      }

      for (const record_ of page.records) {
        if (
          !/^\d{1,32}$/.test(record_.historyId) ||
          BigInt(record_.historyId) <= lastRecord
        )
          throw new Error("Gmail history record is invalid.");
        lastRecord = BigInt(record_.historyId);
        if (lastRecord > BigInt(profile.historyId)) continue;
        if (record_.messagesDeleted.length) {
          deleted = true;
          for (const message of record_.messagesDeleted)
            recordUnknown(message.messageId, "message_deleted");
        }
        for (const added of record_.messagesAdded) {
          if (seenMessageIds.has(added.messageId)) continue;
          if (seenMessageIds.size >= 1000)
            throw new Error("Gmail metadata read limit exceeded.");
          seenMessageIds.add(added.messageId);
          await processMessage(
            added.messageId,
            added.gmailThreadId,
            record_.historyId,
          );
        }
      }

      latestHistoryId = page.historyId;
      pageToken = page.nextPageToken;
      if (!pageToken) break;
      if (seenPageTokens.has(pageToken)) {
        throw new Error("Gmail history page token repeated.");
      }
      seenPageTokens.add(pageToken);
    }

    if (
      !/^\d{1,32}$/.test(latestHistoryId) ||
      BigInt(latestHistoryId) < BigInt(profile.historyId)
    )
      throw new Error("Gmail history did not reach the requested head.");
    await repository.commitReplyCoverage(db, {
      binding,
      expectedCursor: state.cursor,
      expectedCoverageId: state.coverageId,
      expectedObservedUntil: state.observedUntil,
      historyStart: cursor,
      historyEnd: profile.historyId,
      observedFrom: state.observedUntil,
      observedUntil:
        deleted || gapReason ? headResponseEnded : headRequestStarted,
      headRequestedAt: headRequestStarted,
      headRespondedAt: headResponseEnded,
      state: deleted || gapReason ? "gap" : "complete",
      reason: gapReason ?? (deleted ? "message_deleted" : null),
      unknownObservations,
    });
    return summary;
  };
}
