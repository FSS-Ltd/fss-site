import { createHash } from "node:crypto";
import { hasRequiredGmailScopes, sameAccountScopes } from "../google-oauth";
import { validTransitionUsageProvenance } from "../../campaigns/account-usage";
import type { GmailGrantBinding } from "./live-client";
import type { GmailClient, GmailMessageMetadata } from "./types";
import { countGmailRecipients } from "./recipients";

export type UsageObservation = {
  id: string;
  transitionId: string;
  internalDate: string;
  observedUpperBound: string;
  recipientCount: number;
  recipientFingerprint: string;
};
export type UsageState = {
  binding: GmailGrantBinding;
  baselineAt: Date;
  historyStart: string;
  historyEnd: string;
  capturedAt: Date;
  observations: UsageObservation[];
};
type UsageClient = Pick<
  GmailClient,
  "getProfile" | "listSentMessages" | "listHistory" | "getMessageMetadata"
>;
export type UsageResult =
  | { status: "complete"; state: UsageState }
  | { status: "held"; reason: string; state: UsageState };
class UsageHold extends Error {}
const DAY = 86_400_000;
const HISTORY_ID = /^\d{1,32}$/;
function recipientFingerprint(message: GmailMessageMetadata): string {
  return createHash("sha256")
    .update(JSON.stringify([message.to, message.cc, message.bcc]))
    .digest("hex");
}

function sameBinding(a: GmailGrantBinding, b: GmailGrantBinding): boolean {
  return (
    a.connectionId === b.connectionId &&
    a.googleSubject === b.googleSubject &&
    a.grantEpoch === b.grantEpoch &&
    sameAccountScopes(a.grantedScopes, b.grantedScopes)
  );
}

export async function observeGmailUsage(input: {
  client: UsageClient;
  binding: GmailGrantBinding;
  subjectEmail: string;
  prior: UsageState | null;
  now: () => Date;
}): Promise<UsageResult> {
  if (
    !input.binding.connectionId.trim() ||
    !input.binding.googleSubject.trim() ||
    !Number.isSafeInteger(input.binding.grantEpoch) ||
    input.binding.grantEpoch <= 0 ||
    !hasRequiredGmailScopes(input.binding.grantedScopes)
  )
    throw new Error("Gmail usage grant is invalid.");
  const capturedAt = input.now();
  const profile = await input.client.getProfile();
  const headRespondedAt = input.now();
  if (
    !Number.isFinite(capturedAt.getTime()) ||
    !Number.isFinite(headRespondedAt.getTime()) ||
    capturedAt > headRespondedAt ||
    profile.emailAddress.trim().toLowerCase() !==
      input.subjectEmail.trim().toLowerCase() ||
    !HISTORY_ID.test(profile.historyId)
  )
    throw new Error("Gmail usage head is invalid.");
  const prior = input.prior;
  if (
    prior &&
    (!sameBinding(prior.binding, input.binding) ||
      !HISTORY_ID.test(prior.historyStart) ||
      !HISTORY_ID.test(prior.historyEnd) ||
      BigInt(prior.historyEnd) > BigInt(profile.historyId) ||
      !Number.isFinite(prior.baselineAt.getTime()))
  )
    throw new Error("Gmail usage grant or history changed.");
  const retained =
    prior?.observations.filter(
      (entry) =>
        Date.parse(entry.observedUpperBound) > capturedAt.getTime() - DAY,
    ) ?? [];
  if (
    prior &&
    !validTransitionUsageProvenance(
      retained,
      retained.length,
      retained.reduce((sum, entry) => sum + entry.recipientCount, 0),
      capturedAt,
      headRespondedAt,
    )
  )
    throw new Error("Gmail usage prior evidence is invalid.");
  const state: UsageState = {
    binding: input.binding,
    baselineAt: prior?.baselineAt ?? headRespondedAt,
    historyStart: prior?.historyStart ?? profile.historyId,
    historyEnd: profile.historyId,
    capturedAt,
    observations: retained,
  };
  const ids = new Set<string>();
  const cache = new Map<string, GmailMessageMetadata>();
  async function read(id: string): Promise<GmailMessageMetadata> {
    const existing = cache.get(id);
    if (existing) return existing;
    if (cache.size >= 1000) throw new UsageHold("metadata_limit");
    const message = await input.client.getMessageMetadata(id);
    if (message.messageId !== id) throw new UsageHold("metadata_invalid");
    cache.set(id, message);
    return message;
  }
  if (!prior) {
    let token: string | undefined;
    const tokens = new Set<string>();
    const pending: Array<{ message: GmailMessageMetadata; count: number }> = [];
    let reason = "baseline_unmatured";
    try {
      for (let pages = 0; ; pages++) {
        if (pages >= 10) throw new UsageHold("sent_list_limit");
        const page = await input.client.listSentMessages({ pageToken: token });
        if (page.messages.length > 100) throw new UsageHold("sent_list_limit");
        for (const item of page.messages) {
          if (ids.has(item.messageId)) throw new UsageHold("duplicate_sent_id");
          ids.add(item.messageId);
          const message = await read(item.messageId);
          const count = countGmailRecipients(message);
          if (
            !message.labelIds.includes("SENT") ||
            message.gmailThreadId !== item.gmailThreadId ||
            count === null ||
            !Number.isFinite(Date.parse(message.receivedAt))
          )
            throw new UsageHold("metadata_unknown");
          pending.push({ message, count });
        }
        token = page.nextPageToken;
        if (!token) break;
        if (tokens.has(token)) throw new UsageHold("sent_page_loop");
        tokens.add(token);
      }
    } catch (error) {
      reason =
        error instanceof UsageHold
          ? error.message
          : "sent_observation_incomplete";
    }
    const upper = input.now();
    if (!Number.isFinite(upper.getTime()) || upper < headRespondedAt)
      throw new Error("Gmail usage clock is invalid.");
    state.observations = pending.map(({ message, count }) => ({
      id: message.messageId,
      transitionId: `baseline:${profile.historyId}:${message.messageId}`,
      internalDate: message.receivedAt,
      observedUpperBound: upper.toISOString(),
      recipientCount: count,
      recipientFingerprint: recipientFingerprint(message),
    }));
    if (
      !validTransitionUsageProvenance(
        state.observations,
        state.observations.length,
        state.observations.reduce(
          (sum, entry) => sum + entry.recipientCount,
          0,
        ),
        capturedAt,
        upper,
      )
    )
      throw new Error("Gmail usage evidence is invalid.");
    return { status: "held", reason, state };
  }
  let token: string | undefined;
  const tokens = new Set<string>();
  const transitionIds = new Set(retained.map((entry) => entry.transitionId));
  let latest = prior.historyEnd;
  let lastRecord = BigInt(prior.historyEnd);
  try {
    for (let pages = 0; ; pages++) {
      if (pages >= 20) throw new UsageHold("history_page_limit");
      const page = await input.client.listHistory({
        startHistoryId: prior.historyEnd,
        pageToken: token,
        includeLabelChanges: true,
      });
      if (!HISTORY_ID.test(page.historyId))
        throw new UsageHold("history_invalid");
      latest = page.historyId;
      for (const record of page.records) {
        if (
          !HISTORY_ID.test(record.historyId) ||
          BigInt(record.historyId) <= lastRecord ||
          !record.labelsAdded ||
          !record.labelsRemoved
        )
          throw new UsageHold("history_invalid");
        lastRecord = BigInt(record.historyId);
        if (BigInt(record.historyId) > BigInt(profile.historyId)) continue;
        if (
          record.messagesDeleted.length ||
          (record.labelsRemoved ?? []).some((item) =>
            item.labelIds.includes("SENT"),
          )
        )
          throw new UsageHold("history_evidence_deleted");
        const candidates = [
          ...record.messagesAdded.map((item) => ({ ...item, kind: "added" })),
          ...(record.labelsAdded ?? [])
            .filter((item) => item.labelIds.includes("SENT"))
            .map((item) => ({ ...item, kind: "label" })),
        ];
        for (const item of candidates) {
          const transitionId = `${record.historyId}:${item.messageId}`;
          if (transitionIds.has(transitionId)) continue;
          const message = await read(item.messageId);
          if (
            !HISTORY_ID.test(message.historyId) ||
            BigInt(message.historyId) > BigInt(profile.historyId) ||
            BigInt(message.historyId) < BigInt(record.historyId) ||
            message.gmailThreadId !== item.gmailThreadId
          )
            throw new UsageHold("metadata_unknown");
          if (!message.labelIds.includes("SENT") && item.kind === "added")
            continue;
          const count = countGmailRecipients(message);
          if (
            !message.labelIds.includes("SENT") ||
            count === null ||
            !Number.isFinite(Date.parse(message.receivedAt))
          )
            throw new UsageHold("metadata_unknown");
          const fingerprint = recipientFingerprint(message);
          if (
            state.observations.some(
              (entry) =>
                entry.id === item.messageId &&
                (entry.recipientCount !== count ||
                  entry.recipientFingerprint !== fingerprint),
            )
          )
            throw new UsageHold("recipient_metadata_changed");
          if (state.observations.length >= 1000)
            throw new UsageHold("transition_limit");
          state.observations.push({
            id: item.messageId,
            transitionId,
            internalDate: message.receivedAt,
            observedUpperBound: headRespondedAt.toISOString(),
            recipientCount: count,
            recipientFingerprint: fingerprint,
          });
          transitionIds.add(transitionId);
        }
      }
      token = page.nextPageToken;
      if (!token) break;
      if (tokens.has(token)) throw new UsageHold("history_page_loop");
      tokens.add(token);
    }
    if (BigInt(latest) < BigInt(profile.historyId))
      throw new UsageHold("history_incomplete");
  } catch (error) {
    state.baselineAt = headRespondedAt;
    state.historyStart = profile.historyId;
    return {
      status: "held",
      reason: error instanceof UsageHold ? error.message : "history_incomplete",
      state,
    };
  }
  if (
    !validTransitionUsageProvenance(
      state.observations,
      state.observations.length,
      state.observations.reduce((sum, entry) => sum + entry.recipientCount, 0),
      capturedAt,
      headRespondedAt,
    )
  )
    throw new Error("Gmail usage evidence is invalid.");
  return capturedAt.getTime() >= state.baselineAt.getTime() + DAY
    ? { status: "complete", state }
    : { status: "held", reason: "baseline_unmatured", state };
}
