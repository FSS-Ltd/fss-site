import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import {
  GmailClientError,
  type GmailClient,
} from "../integrations/gmail/types";
import { createOutreachDispatcher } from "./dispatcher";
import type {
  CancelMessageInput,
  ClaimedMessage,
  FailMessageInput,
  FollowUpTemplate,
  RecordSentInput,
  SendContext,
  SequenceDispatchRepository,
  ThreadReferences,
} from "./dispatcher-repository";

const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const NOW = new Date("2026-08-18T09:00:00.000Z");

function claimedFirstEmail(
  overrides: Partial<ClaimedMessage> = {},
): ClaimedMessage {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    previousStatus: "queued",
    sequenceEnrollmentId: "22222222-2222-4222-8222-222222222222",
    prospectId: "33333333-3333-4333-8333-333333333333",
    contactId: "44444444-4444-4444-8444-444444444444",
    stepNumber: 0,
    attemptCount: 1,
    rfcMessageId:
      "<growthos.11111111-1111-4111-8111-111111111111@faithfulsoftware.dev>",
    idempotencyKey: "first_email:draft-id",
    subjectSnapshot: "A practical idea",
    htmlSnapshot: "<p>Body</p>",
    textSnapshot: "Body",
    ...overrides,
  };
}

function sendContext(overrides: Partial<SendContext> = {}): SendContext {
  return {
    enrollmentStatus: "active",
    gmailThreadId: null,
    contactEmail: "contact@example.test",
    normalisedEmail: "contact@example.test",
    firstName: "Sam",
    businessName: "Example & Sons",
    firstEmailSubject: "A practical idea",
    ...overrides,
  };
}

type FakeState = {
  queue: ClaimedMessage[];
  contexts: Map<string, SendContext>;
  suppressed: Set<string>;
  inboundByEnrollment: Set<string>;
  templates: Map<string, FollowUpTemplate>;
  references: Map<string, ThreadReferences>;
  cancels: CancelMessageInput[];
  fails: FailMessageInput[];
  sent: RecordSentInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    queue: [claimedFirstEmail()],
    contexts: new Map([
      ["22222222-2222-4222-8222-222222222222", sendContext()],
    ]),
    suppressed: new Set(),
    inboundByEnrollment: new Set(),
    templates: new Map(),
    references: new Map(),
    cancels: [],
    fails: [],
    sent: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): SequenceDispatchRepository {
  return {
    async claimDueMessage() {
      return state.queue.shift() ?? null;
    },
    async getSendContext(_db, sequenceEnrollmentId) {
      return state.contexts.get(sequenceEnrollmentId) ?? null;
    },
    async isSuppressed(_db, normalisedEmail) {
      return state.suppressed.has(normalisedEmail);
    },
    async hasNewerInboundMessage(_db, sequenceEnrollmentId) {
      return state.inboundByEnrollment.has(sequenceEnrollmentId);
    },
    async getFollowUpTemplate(_db, templateKey) {
      return state.templates.get(templateKey) ?? null;
    },
    async getThreadReferences(_db, sequenceEnrollmentId) {
      return (
        state.references.get(sequenceEnrollmentId) ?? {
          parentMessageId: null,
          references: [],
        }
      );
    },
    async cancelMessage(_db, input) {
      state.cancels.push(input);
    },
    async failMessage(_db, input) {
      state.fails.push(input);
    },
    async recordSent(_db, input) {
      state.sent.push(input);
    },
  };
}

function fakeGmailClient(
  overrides: Partial<
    Pick<GmailClient, "sendMessage" | "findByRfcMessageId">
  > = {},
): Pick<GmailClient, "sendMessage" | "findByRfcMessageId"> {
  return {
    sendMessage:
      overrides.sendMessage ??
      (async () => ({
        messageId: "provider-message-1",
        gmailThreadId: "provider-thread-1",
      })),
    findByRfcMessageId: overrides.findByRfcMessageId ?? (async () => null),
  };
}

const db = {} as GrowthDb;

function createDispatch(
  state: FakeState,
  overrides: {
    gmailClient?: Pick<GmailClient, "sendMessage" | "findByRfcMessageId">;
  } = {},
) {
  return createOutreachDispatcher({
    repository: createFakeRepository(state),
    gmailClient: overrides.gmailClient ?? fakeGmailClient(),
    founderEmail: FOUNDER_EMAIL,
    now: () => NOW,
    createLeaseToken: () => "lease-token",
  });
}

test("sends a due first email and schedules the automatic Day 5 and 14 follow-ups", async () => {
  const state = createFakeState();
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.deepEqual(summary, {
    claimed: 1,
    sent: 1,
    cancelled: 0,
    reconciled: 0,
    retryableFailures: 0,
    permanentFailures: 0,
  });
  assert.equal(state.sent.length, 1);
  const recorded = state.sent[0]!;
  assert.equal(recorded.providerMessageId, "provider-message-1");
  assert.equal(recorded.followUps?.length, 2);
  assert.deepEqual(
    recorded.followUps?.map((followUp) => followUp.stepNumber).sort(),
    [1, 3],
  );
});

test("stops claiming once no messages are due", async () => {
  const state = createFakeState({ queue: [] });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.deepEqual(summary, {
    claimed: 0,
    sent: 0,
    cancelled: 0,
    reconciled: 0,
    retryableFailures: 0,
    permanentFailures: 0,
  });
});

test("cancels a message when the enrollment is no longer active", async () => {
  const state = createFakeState({
    contexts: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        sendContext({ enrollmentStatus: "paused" }),
      ],
    ]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.equal(summary.cancelled, 1);
  assert.equal(state.cancels[0]?.errorCode, "enrollment_not_active");
});

test("cancels a message when the contact is suppressed", async () => {
  const state = createFakeState({
    suppressed: new Set(["contact@example.test"]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.equal(summary.cancelled, 1);
  assert.equal(state.cancels[0]?.errorCode, "suppressed_contact");
  assert.equal(state.sent.length, 0);
});

test("cancels a message when a newer inbound reply exists", async () => {
  const state = createFakeState({
    inboundByEnrollment: new Set(["22222222-2222-4222-8222-222222222222"]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.equal(summary.cancelled, 1);
  assert.equal(state.cancels[0]?.errorCode, "reply_detected");
});

test("reconciles a lost provider response through the RFC Message-ID and does not resend", async () => {
  let sendCalled = false;
  const state = createFakeState({
    queue: [claimedFirstEmail({ previousStatus: "retry", attemptCount: 2 })],
  });
  const dispatch = createDispatch(state, {
    gmailClient: fakeGmailClient({
      sendMessage: async () => {
        sendCalled = true;
        return {
          messageId: "should-not-be-used",
          gmailThreadId: "should-not-be-used",
        };
      },
      findByRfcMessageId: async () => ({
        messageId: "reconciled-message-1",
        gmailThreadId: "reconciled-thread-1",
        historyId: "1",
        labelIds: [],
        receivedAt: NOW.toISOString(),
        from: FOUNDER_EMAIL,
        subject: "A practical idea",
        rfcMessageId: claimedFirstEmail().rfcMessageId,
        autoSubmitted: null,
        precedence: null,
        returnPath: null,
        autoResponseSuppress: null,
      }),
    }),
  });

  const summary = await dispatch(db, NOW);

  assert.equal(sendCalled, false);
  assert.equal(summary.reconciled, 1);
  assert.equal(summary.sent, 0);
  assert.equal(state.sent[0]?.providerMessageId, "reconciled-message-1");
});

test("marks a retryable provider failure for retry and a permanent failure as failed", async () => {
  const retryable = createFakeState();
  const retryDispatch = createDispatch(retryable, {
    gmailClient: fakeGmailClient({
      sendMessage: async () => {
        throw new GmailClientError("RETRYABLE_PROVIDER_ERROR");
      },
    }),
  });
  const retrySummary = await retryDispatch(db, NOW);
  assert.equal(retrySummary.retryableFailures, 1);
  assert.equal(retryable.fails[0]?.status, "retry");

  const permanent = createFakeState();
  const permanentDispatch = createDispatch(permanent, {
    gmailClient: fakeGmailClient({
      sendMessage: async () => {
        throw new GmailClientError("PERMANENT_PROVIDER_ERROR");
      },
    }),
  });
  const permanentSummary = await permanentDispatch(db, NOW);
  assert.equal(permanentSummary.permanentFailures, 1);
  assert.equal(permanent.fails[0]?.status, "failed");
});

test("sends a due follow-up through its published template with merge fields and threading", async () => {
  let sentInput: Parameters<GmailClient["sendMessage"]>[0] | undefined;
  const state = createFakeState({
    queue: [
      claimedFirstEmail({
        id: "55555555-5555-4555-8555-555555555555",
        stepNumber: 1,
        subjectSnapshot: null,
        htmlSnapshot: null,
        textSnapshot: null,
        rfcMessageId: null,
      }),
    ],
    contexts: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        sendContext({ gmailThreadId: "thread-1" }),
      ],
    ]),
    templates: new Map([
      [
        "gmail_follow_up_day_5",
        {
          htmlTemplate: "<p>Hi {{firstName}},</p><p>{{businessName}}</p>",
          textTemplate: "Hi {{firstName}},\n\n{{businessName}}",
          requiredFields: ["firstName", "businessName"],
        },
      ],
    ]),
    references: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        {
          parentMessageId: "<growthos.first@faithfulsoftware.dev>",
          references: ["<growthos.first@faithfulsoftware.dev>"],
        },
      ],
    ]),
  });
  const dispatch = createDispatch(state, {
    gmailClient: fakeGmailClient({
      sendMessage: async (input) => {
        sentInput = input;
        return { messageId: "provider-message-2", gmailThreadId: "thread-1" };
      },
    }),
  });

  const summary = await dispatch(db, NOW);

  assert.equal(summary.sent, 1);
  assert.equal(sentInput?.gmailThreadId, "thread-1");
  assert.equal(state.sent[0]?.followUps, null);
  assert.match(state.sent[0]?.htmlSnapshot ?? "", /Sam/);
  assert.match(state.sent[0]?.htmlSnapshot ?? "", /Example &amp; Sons/);
});

test("sends the founder-approved Day 11 SEO audit from its stored snapshot", async () => {
  let sentInput: Parameters<GmailClient["sendMessage"]>[0] | undefined;
  const state = createFakeState({
    queue: [
      claimedFirstEmail({
        id: "55555555-5555-4555-8555-555555555556",
        stepNumber: 2,
        subjectSnapshot: "Your practical SEO audit",
        htmlSnapshot: "<p>Download the audit.</p>",
        textSnapshot: "Download the audit.",
        rfcMessageId: null,
      }),
    ],
    contexts: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        sendContext({ gmailThreadId: "thread-1" }),
      ],
    ]),
    references: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        {
          parentMessageId: "<growthos.second@faithfulsoftware.dev>",
          references: ["<growthos.first@faithfulsoftware.dev>"],
        },
      ],
    ]),
  });
  const dispatch = createDispatch(state, {
    gmailClient: fakeGmailClient({
      sendMessage: async (input) => {
        sentInput = input;
        return { messageId: "provider-message-3", gmailThreadId: "thread-1" };
      },
    }),
  });

  const summary = await dispatch(db, NOW);

  assert.equal(summary.sent, 1);
  assert.equal(sentInput?.gmailThreadId, "thread-1");
  assert.equal(state.sent[0]?.subjectSnapshot, "Your practical SEO audit");
  assert.equal(state.sent[0]?.htmlSnapshot, "<p>Download the audit.</p>");
  assert.equal(state.templates.size, 0);
});

test("blocks a follow-up send when a required merge field is missing", async () => {
  const state = createFakeState({
    queue: [
      claimedFirstEmail({
        stepNumber: 1,
        subjectSnapshot: null,
        htmlSnapshot: null,
        textSnapshot: null,
      }),
    ],
    contexts: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        sendContext({ gmailThreadId: "thread-1", businessName: "" }),
      ],
    ]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db, NOW);

  assert.equal(summary.permanentFailures, 1);
  assert.equal(state.fails[0]?.errorCode, "missing_merge_field");
  assert.equal(state.sent.length, 0);
});

test("respects the maximum messages per run", async () => {
  const state = createFakeState({
    queue: [
      claimedFirstEmail({ id: "11111111-1111-4111-8111-111111111111" }),
      claimedFirstEmail({ id: "66666666-6666-4666-8666-666666666666" }),
      claimedFirstEmail({ id: "77777777-7777-4777-8777-777777777777" }),
    ],
  });
  const dispatch = createOutreachDispatcher({
    repository: createFakeRepository(state),
    gmailClient: fakeGmailClient(),
    founderEmail: FOUNDER_EMAIL,
    now: () => NOW,
    createLeaseToken: () => "lease-token",
    maxMessagesPerRun: 2,
  });

  const summary = await dispatch(db, NOW);

  assert.equal(summary.claimed, 2);
  assert.equal(state.queue.length, 1);
});
