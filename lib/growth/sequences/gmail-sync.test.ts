import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import {
  GmailClientError,
  type GmailClient,
  type GmailHistoryResult,
  type GmailMessageMetadata,
} from "../integrations/gmail/types";
import type { RecordSentInput } from "./dispatcher-repository";
import { createGmailReplySync } from "./gmail-sync";
import type {
  GmailSyncRepository,
  PendingDraft,
  RecordInboundEventInput,
  ThreadEnrollment,
} from "./gmail-sync-repository";
import type { StopSequenceInput, StoppedSequence } from "./stop";

const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const db = {} as GrowthDb;

function metadata(
  overrides: Partial<GmailMessageMetadata> = {},
): GmailMessageMetadata {
  return {
    messageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    historyId: "100",
    labelIds: ["INBOX"],
    receivedAt: "2026-08-18T09:00:00.000Z",
    from: "Sam Reader <sam@example.test>",
    subject: "Re: A practical idea",
    rfcMessageId: "<reply-message-id@example.test>",
    autoSubmitted: null,
    precedence: null,
    returnPath: null,
    autoResponseSuppress: null,
    ...overrides,
  };
}

function historyPage(
  messageIds: string[],
  overrides: Partial<GmailHistoryResult> = {},
): GmailHistoryResult {
  return {
    historyId: "200",
    records: [
      {
        historyId: "200",
        messagesAdded: messageIds.map((messageId) => ({
          messageId,
          gmailThreadId: "gmail-thread-1",
        })),
        messagesDeleted: [],
      },
    ],
    ...overrides,
  };
}

type FakeState = {
  cursor: string | null;
  metadataByMessageId: Map<string, GmailMessageMetadata>;
  historyPages: GmailHistoryResult[];
  historyError: GmailClientError | null;
  profileHistoryId: string;
  pendingDrafts: Map<string, PendingDraft>;
  enrollmentsByThread: Map<string, ThreadEnrollment>;
  recordedEvents: RecordInboundEventInput[];
  alreadyRecordedMessageIds: Set<string>;
  activated: string[];
  stops: StopSequenceInput[];
  recorded: RecordSentInput[];
  cursorsSet: string[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    cursor: "100",
    metadataByMessageId: new Map(),
    historyPages: [],
    historyError: null,
    profileHistoryId: "999",
    pendingDrafts: new Map(),
    enrollmentsByThread: new Map(),
    recordedEvents: [],
    alreadyRecordedMessageIds: new Set(),
    activated: [],
    stops: [],
    recorded: [],
    cursorsSet: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): GmailSyncRepository {
  return {
    async getCursor() {
      return state.cursor;
    },
    async setCursor(_db, _subjectEmail, historyId) {
      state.cursorsSet.push(historyId);
    },
    async findPendingDraftByRfcMessageId(_db, rfcMessageId) {
      return state.pendingDrafts.get(rfcMessageId) ?? null;
    },
    async findEnrollmentByThread(_db, gmailThreadId) {
      return state.enrollmentsByThread.get(gmailThreadId) ?? null;
    },
    async recordInboundEvent(_db, input) {
      if (state.alreadyRecordedMessageIds.has(input.gmailMessageId)) {
        return { alreadyRecorded: true };
      }
      state.recordedEvents.push(input);
      return { alreadyRecorded: false };
    },
    async activatePendingApproval(_db, sequenceEnrollmentId) {
      state.activated.push(sequenceEnrollmentId);
    },
  };
}

function createFakeGmailClient(
  state: FakeState,
): Pick<GmailClient, "listHistory" | "getMessageMetadata" | "getProfile"> {
  let pageIndex = 0;
  return {
    async listHistory() {
      if (state.historyError) throw state.historyError;
      const page = state.historyPages[pageIndex];
      pageIndex += 1;
      return page ?? { historyId: state.cursor ?? "100", records: [] };
    },
    async getMessageMetadata(messageId) {
      const found = state.metadataByMessageId.get(messageId);
      if (!found) throw new Error(`No fake metadata for ${messageId}`);
      return found;
    },
    async getProfile() {
      return { emailAddress: FOUNDER_EMAIL, historyId: state.profileHistoryId };
    },
  };
}

function createSync(
  state: FakeState,
  overrides: {
    stop?: (db: GrowthDb, input: StopSequenceInput) => Promise<StoppedSequence>;
    record?: (db: GrowthDb, input: RecordSentInput) => Promise<void>;
  } = {},
) {
  return createGmailReplySync({
    repository: createFakeRepository(state),
    gmailClient: createFakeGmailClient(state),
    founderEmail: FOUNDER_EMAIL,
    stop:
      overrides.stop ??
      (async (_db, input) => {
        state.stops.push(input);
        return {
          sequenceId: input.sequenceId,
          status: "stopped",
          alreadyApplied: false,
        };
      }),
    record:
      overrides.record ??
      (async (_db, input) => {
        state.recorded.push(input);
      }),
    createCorrelationId: () => "correlation-id",
  });
}

test("bootstraps the cursor without processing history on the first run", async () => {
  const state = createFakeState({ cursor: null });
  const sync = createSync(state);

  const summary = await sync(db);

  assert.deepEqual(summary, {
    processed: 0,
    replies: 0,
    bounces: 0,
    autoResponses: 0,
    ownMessages: 0,
    reconciledDrafts: 0,
    cursorReset: false,
  });
  assert.deepEqual(state.cursorsSet, ["999"]);
});

test("stops the sequence as a reply for an inbound message from outside the founder mailbox", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "enrollment-1",
          status: "active",
          prospectId: "prospect-1",
          contactId: "contact-1",
        },
      ],
    ]),
  });
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.replies, 1);
  assert.equal(state.stops.length, 1);
  assert.equal(state.stops[0]?.reason, "reply");
  assert.equal(state.stops[0]?.sequenceId, "enrollment-1");
  assert.deepEqual(state.stops[0]?.actor, {
    type: "gmail_sync",
    id: "gmail-sync",
  });
});

test("does not stop the sequence for the founder's own sent message", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({ from: `Founder <${FOUNDER_EMAIL}>`, rfcMessageId: null }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.ownMessages, 1);
  assert.equal(summary.replies, 0);
  assert.equal(state.stops.length, 0);
});

test("records but does not stop the sequence for an automated response", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "enrollment-1",
          status: "active",
          prospectId: "prospect-1",
          contactId: "contact-1",
        },
      ],
    ]),
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({ autoSubmitted: "auto-replied" }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.autoResponses, 1);
  assert.equal(summary.replies, 0);
  assert.equal(state.stops.length, 0);
  assert.equal(state.recordedEvents[0]?.eventType, "auto_response");
});

test("stops the sequence and records a bounce event for a mailer-daemon sender", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "enrollment-1",
          status: "active",
          prospectId: "prospect-1",
          contactId: "contact-1",
        },
      ],
    ]),
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
    }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.bounces, 1);
  assert.equal(state.stops[0]?.reason, "bounce");
});

test("resets the cursor to the current profile history ID when the history ID expires", async () => {
  const state = createFakeState({
    historyError: new GmailClientError("HISTORY_ID_EXPIRED"),
  });
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.cursorReset, true);
  assert.deepEqual(state.cursorsSet, ["999"]);
});

test("processes each message once across a duplicate history page", async () => {
  const state = createFakeState({
    historyPages: [
      historyPage(["gmail-message-1"]),
      historyPage(["gmail-message-1"], {
        historyId: "201",
        nextPageToken: undefined,
      }),
    ],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "enrollment-1",
          status: "active",
          prospectId: "prospect-1",
          contactId: "contact-1",
        },
      ],
    ]),
  });
  state.historyPages[0] = {
    ...state.historyPages[0]!,
    nextPageToken: "page-2",
  };
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.processed, 1);
  assert.equal(summary.replies, 1);
});

test("skips a duplicate inbound event already recorded by a prior sync run", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "enrollment-1",
          status: "active",
          prospectId: "prospect-1",
          contactId: "contact-1",
        },
      ],
    ]),
    alreadyRecordedMessageIds: new Set(["gmail-message-1"]),
  });
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.replies, 0);
  assert.equal(state.stops.length, 0);
});

test("reconciles a founder-sent provider draft through its RFC Message-ID and activates the sequence", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    pendingDrafts: new Map([
      [
        "<growthos.first@faithfulsoftware.dev>",
        {
          id: "message-1",
          sequenceEnrollmentId: "enrollment-1",
          prospectId: "prospect-1",
          contactId: "contact-1",
          subjectSnapshot: "Subject",
          htmlSnapshot: "<p>Body</p>",
          textSnapshot: "Body",
        },
      ],
    ]),
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({
      from: `Founder <${FOUNDER_EMAIL}>`,
      rfcMessageId: "<growthos.first@faithfulsoftware.dev>",
    }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.reconciledDrafts, 1);
  assert.deepEqual(state.activated, ["enrollment-1"]);
  assert.equal(state.recorded[0]?.messageId, "message-1");
  assert.equal(state.recorded[0]?.followUps?.length, 3);
});

test("does nothing for an own message that matches no pending draft (unsent or deleted)", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({
      from: `Founder <${FOUNDER_EMAIL}>`,
      rfcMessageId: "<growthos.unknown@faithfulsoftware.dev>",
    }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.reconciledDrafts, 0);
  assert.equal(state.activated.length, 0);
  assert.equal(state.recorded.length, 0);
});

test("ignores an inbound message on a thread that is not one of ours", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
  });
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.processed, 1);
  assert.equal(summary.replies, 0);
  assert.equal(state.stops.length, 0);
});
