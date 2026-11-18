import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import {
  GmailClientError,
  type GmailClient,
  type GmailHistoryResult,
  type GmailMessageMetadata,
} from "../integrations/gmail/types";
import { createGmailReplySync } from "./gmail-sync";
import type {
  GmailSyncRepository,
  PendingDraft,
  RecordInboundEventInput,
  ThreadEnrollment,
} from "./gmail-sync-repository";
import type { StopSequenceInput, StoppedSequence } from "./stop";
import { SequenceStopError } from "./stop";

const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const db = {} as GrowthDb;

function metadata(
  overrides: Partial<GmailMessageMetadata> = {},
): GmailMessageMetadata {
  return {
    messageId: "gmail-message-1",
    gmailThreadId: "gmail-thread-1",
    historyId: "200",
    labelIds: ["INBOX"],
    receivedAt: "2026-08-18T09:00:00.000Z",
    from: "Sam Reader <sam@example.test>",
    subject: "Re: A practical idea",
    rfcMessageId: "<reply-message-id@example.test>",
    autoSubmitted: null,
    precedence: null,
    returnPath: null,
    autoResponseSuppress: null,
    to: null,
    cc: null,
    bcc: null,
    inReplyTo: null,
    references: null,
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
        historyId: overrides.historyId ?? "200",
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
  headOverride?: string;
  pendingDrafts: Map<string, PendingDraft>;
  enrollmentsByThread: Map<string, ThreadEnrollment>;
  recordedEvents: RecordInboundEventInput[];
  alreadyRecordedMessageIds: Set<string>;
  activated: string[];
  stops: StopSequenceInput[];
  recorded: unknown[];
  cursorsSet: string[];
  coverageWrites: Array<{
    state: string;
    reason: string | null;
    historyStart: string | null;
    historyEnd: string;
    unknownObservations: Array<{ messageId: string; reason: string }>;
  }>;
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
    coverageWrites: [],
    ...overrides,
  };
}

function createFakeRepository(
  state: FakeState,
  stop = async (
    _db: GrowthDb,
    input: StopSequenceInput,
  ): Promise<StoppedSequence> => {
    state.stops.push(input);
    return {
      sequenceId: input.sequenceId,
      status: "stopped",
      alreadyApplied: false,
    };
  },
): GmailSyncRepository {
  return {
    async classifyGmailRouting(db, input) {
      return this.findEnrollmentByThread(db, input.threadId, input.binding);
    },
    async loadReplySyncState() {
      return {
        cursor: state.cursor,
        historyCursor: state.cursor,
        coverageId: state.cursor ? "coverage-id" : null,
        observedUntil: state.cursor ? new Date("2026-01-01T00:00:00Z") : null,
      };
    },
    async commitReplyCoverage(_db, input) {
      state.coverageWrites.push(input);
      state.cursorsSet.push(input.historyEnd);
      return "coverage-new";
    },
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
      const enrollment = state.enrollmentsByThread.get(gmailThreadId);
      return enrollment ? { kind: "unique", enrollment } : { kind: "none" };
    },
    async recordInboundEvent(_db, input) {
      if (input.eventType !== "auto_response")
        await stop(_db, {
          sequenceId: input.sequenceEnrollmentId,
          reason: input.eventType,
          actor: {
            type: "gmail_sync",
            id: "gmail-sync",
            binding: input.binding,
          },
          correlationId: input.correlationId,
        });
      if (state.alreadyRecordedMessageIds.has(input.gmailMessageId)) {
        return { alreadyRecorded: true };
      }
      state.recordedEvents.push(input);
      state.alreadyRecordedMessageIds.add(input.gmailMessageId);
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
      return {
        emailAddress: FOUNDER_EMAIL,
        historyId:
          state.headOverride ??
          (state.cursor && !state.historyError
            ? (state.historyPages.at(-1)?.historyId ?? state.cursor)
            : state.profileHistoryId),
      };
    },
  };
}

function createSync(
  state: FakeState,
  overrides: {
    stop?: (db: GrowthDb, input: StopSequenceInput) => Promise<StoppedSequence>;
  } = {},
) {
  const stop =
    overrides.stop ??
    (async (
      _db: GrowthDb,
      input: StopSequenceInput,
    ): Promise<StoppedSequence> => {
      state.stops.push(input);
      return {
        sequenceId: input.sequenceId,
        status: "stopped",
        alreadyApplied: false,
      };
    });
  return createGmailReplySync({
    repository: createFakeRepository(state, stop),
    gmailClient: createFakeGmailClient(state),
    founderEmail: FOUNDER_EMAIL,
    binding: {
      connectionId: "11111111-1111-4111-8111-111111111112",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
    stop,
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
  assert.deepEqual(
    state.coverageWrites.map(({ state, reason, historyStart, historyEnd }) => ({
      state,
      reason,
      historyStart,
      historyEnd,
    })),
    [
      {
        state: "gap",
        reason: "initial_history_unknown",
        historyStart: null,
        historyEnd: "999",
      },
    ],
  );
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
    binding: {
      connectionId: "11111111-1111-4111-8111-111111111112",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
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

test("does not advance coverage for duplicate history records across pages", async () => {
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
  state.historyPages[1]!.records[0]!.historyId = "200";
  state.historyPages[0] = {
    ...state.historyPages[0]!,
    nextPageToken: "page-2",
  };
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const sync = createSync(state);

  await assert.rejects(sync(db), /history record/i);
  assert.equal(state.recordedEvents.length, 1);
  assert.deepEqual(state.coverageWrites, []);
});

test("retries an inbound event after an atomic stop failure", async () => {
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
  await assert.rejects(
    createSync(state, {
      stop: async () => {
        throw new Error("stop failed");
      },
    })(db),
    /stop failed/,
  );
  assert.deepEqual(state.cursorsSet, []);

  const summary = await createSync(state)(db);

  assert.equal(summary.replies, 1);
  assert.equal(state.recordedEvents.length, 1);
  assert.equal(state.stops.length, 1);
  assert.equal(state.stops[0]?.reason, "reply");
});

test("holds an unbound provider draft observation rather than marking it sent", async () => {
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
      labelIds: ["SENT"],
    }),
  );
  const sync = createSync(state);

  const summary = await sync(db);

  assert.equal(summary.reconciledDrafts, 0);
  assert.deepEqual(state.activated, []);
  assert.equal(state.recorded.length, 0);
  assert.equal(state.coverageWrites[0]?.reason, "unbound_draft_observation");
  assert.deepEqual(state.coverageWrites[0]?.unknownObservations, [
    { messageId: "gmail-message-1", reason: "unbound_draft_observation" },
  ]);
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

test("does not advance the cursor when history repeats a page token", async () => {
  const state = createFakeState({
    historyPages: [
      historyPage([], { nextPageToken: "repeated" }),
      historyPage([], { historyId: "201", nextPageToken: "repeated" }),
    ],
  });

  await assert.rejects(createSync(state)(db), /history page/i);
  assert.deepEqual(state.cursorsSet, []);
});

test("does not reconcile a founder draft without SENT evidence", async () => {
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
          subjectSnapshot: null,
          htmlSnapshot: null,
          textSnapshot: null,
        },
      ],
    ]),
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({
      from: FOUNDER_EMAIL,
      labelIds: ["DRAFT"],
      rfcMessageId: "<growthos.first@faithfulsoftware.dev>",
    }),
  );
  await createSync(state)(db);
  assert.equal(state.recorded.length, 0);
});

test("does not treat an alias SENT message as an inbound reply", async () => {
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
    metadata({ from: "alias@example.test", labelIds: ["SENT"] }),
  );
  await createSync(state)(db);
  assert.equal(state.recordedEvents.length, 0);
  assert.equal(state.stops.length, 0);
});

test("marks deleted history as an explicit coverage gap", async () => {
  const page = historyPage([]);
  page.records[0]!.messagesDeleted = [
    { messageId: "gone", gmailThreadId: "thread" },
  ];
  const state = createFakeState({ historyPages: [page] });
  await createSync(state)(db);
  assert.equal(state.coverageWrites[0]?.state, "gap");
  assert.equal(state.coverageWrites[0]?.reason, "message_deleted");
});

test("does not process a history record beyond the captured head", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["future"], { historyId: "300" })],
    headOverride: "150",
  });
  await createSync(state)(db);
  assert.equal(state.recordedEvents.length, 0);
  assert.equal(state.coverageWrites[0]?.historyEnd, "150");
});

test("protectively pauses an unbound legacy thread and records a coverage gap", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        { id: "legacy", status: "active", prospectId: "p", contactId: "c" },
      ],
    ]),
  });
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const repository = createFakeRepository(state);
  repository.findEnrollmentByThread = async () => ({
    kind: "unknown",
    enrollment: state.enrollmentsByThread.get("gmail-thread-1")!,
    safeToPause: true,
  });
  let terminal = false;
  const sync = createGmailReplySync({
    repository,
    gmailClient: createFakeGmailClient(state),
    founderEmail: FOUNDER_EMAIL,
    binding: {
      connectionId: "11111111-1111-4111-8111-111111111112",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
    stop: async (_db, input) => {
      if (terminal) throw new SequenceStopError("already_stopped");
      state.stops.push(input);
      return {
        sequenceId: input.sequenceId,
        status: "paused",
        alreadyApplied: false,
      };
    },
  });
  await sync(db);
  assert.equal(state.stops[0]?.reason, "pause");
  assert.equal(state.recordedEvents.length, 0);
  assert.equal(state.coverageWrites[0]?.reason, "unknown_account_thread");
  assert.deepEqual(state.coverageWrites[0]?.unknownObservations, [
    { messageId: "gmail-message-1", reason: "unknown_account_thread" },
  ]);
  terminal = true;
  state.historyPages.push(historyPage(["gmail-message-1"]));
  await sync(db);
  assert.equal(state.coverageWrites[1]?.reason, "unknown_account_thread");
});

test("does not make more than 1000 metadata reads or advance a partial cursor", async () => {
  const ids = Array.from({ length: 1001 }, (_, index) => `message-${index}`);
  const state = createFakeState({
    historyPages: [
      historyPage(ids.slice(0, 500), { nextPageToken: "next" }),
      historyPage(ids.slice(500), { historyId: "201" }),
    ],
  });
  for (const id of ids)
    state.metadataByMessageId.set(
      id,
      metadata({
        messageId: id,
        gmailThreadId: "gmail-thread-1",
        historyId: "201",
      }),
    );
  let reads = 0;
  const client = createFakeGmailClient(state);
  const read = client.getMessageMetadata;
  client.getMessageMetadata = async (id) => {
    reads++;
    return read(id);
  };
  const sync = createGmailReplySync({
    repository: createFakeRepository(state),
    gmailClient: client,
    founderEmail: FOUNDER_EMAIL,
    binding: {
      connectionId: "11111111-1111-4111-8111-111111111112",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
  });
  await assert.rejects(sync(db), /metadata.*limit/i);
  assert.equal(reads, 1000);
  assert.deepEqual(state.coverageWrites, []);
});

test("does not mark coverage complete from metadata newer than the captured head", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    headOverride: "200",
  });
  state.metadataByMessageId.set(
    "gmail-message-1",
    metadata({ historyId: "201" }),
  );
  await assert.rejects(createSync(state)(db), /metadata.*history/i);
  assert.deepEqual(state.coverageWrites, []);
});

test("does not pause a thread whose prior subject does not match the bound account", async () => {
  const state = createFakeState({
    historyPages: [historyPage(["gmail-message-1"])],
    enrollmentsByThread: new Map([
      [
        "gmail-thread-1",
        {
          id: "other-subject",
          status: "active",
          prospectId: "p",
          contactId: "c",
        },
      ],
    ]),
  });
  state.metadataByMessageId.set("gmail-message-1", metadata());
  const repository = createFakeRepository(state);
  repository.findEnrollmentByThread = async () => ({
    kind: "unknown",
    enrollment: state.enrollmentsByThread.get("gmail-thread-1")!,
    safeToPause: false,
  });
  await createGmailReplySync({
    repository,
    gmailClient: createFakeGmailClient(state),
    founderEmail: FOUNDER_EMAIL,
    binding: {
      connectionId: "11111111-1111-4111-8111-111111111112",
      googleSubject: "subject",
      grantEpoch: 1,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
    },
  })(db);
  assert.equal(state.stops.length, 0);
  assert.equal(state.coverageWrites[0]?.reason, "unknown_account_thread");
});
