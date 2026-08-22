import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  ClientThankYouError,
  createClientThankYouSender,
  createClientThankYouTestSender,
  NEWSLETTER_OPT_IN_URL,
  renderClientThankYouSnapshot,
  type ClientThankYouDependencies,
  type ClientThankYouRow,
  type RecordInviteRemovedInput,
  type RecordSentInput,
  type RecordTestSentInput,
} from "./client-thank-you";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const messageId = "11111111-1111-4111-8111-111111111111";

function createFakeDb(): GrowthDb {
  const tag = (async () => []) as unknown as GrowthDb;
  (tag as unknown as { json: (value: unknown) => unknown }).json = (value) => value;
  return tag;
}

const db = createFakeDb();
const fixedNow = new Date("2026-08-22T10:00:00.000Z");

function baseRow(overrides: Partial<ClientThankYouRow> = {}): ClientThankYouRow {
  return {
    id: messageId,
    engagementId: "22222222-2222-4222-8222-222222222222",
    engagementName: "the enquiry portal build",
    version: 1,
    status: "pending_approval",
    includedNewsletterInvite: true,
    subjectSnapshot: "Thank you for trusting FSS with the enquiry portal build",
    htmlSnapshot: "<html><body>with invite</body></html>",
    textSnapshot: "with invite",
    checksum: "a".repeat(64),
    recipientFirstName: "Ada",
    recipientEmail: "ada@example.test",
    recipientNormalisedEmail: "ada@example.test",
    testSentAt: null,
    testSentVersion: null,
    ...overrides,
  };
}

type FakeState = {
  message: ClientThankYouRow | null;
  suppressed: boolean;
  testSentCalls: RecordTestSentInput[];
  inviteRemovedCalls: RecordInviteRemovedInput[];
  sentCalls: RecordSentInput[];
  sentShouldNoOp: boolean;
  newsletterInvited: { engagementId: string; invitedAt: Date }[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    message: baseRow(),
    suppressed: false,
    testSentCalls: [],
    inviteRemovedCalls: [],
    sentCalls: [],
    sentShouldNoOp: false,
    newsletterInvited: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): ClientThankYouDependencies {
  return {
    async getMessageById(id) {
      if (!state.message || state.message.id !== id) return null;
      return state.message;
    },
    async isSuppressed() {
      return state.suppressed;
    },
    async recordTestSent(input) {
      state.testSentCalls.push(input);
    },
    async recordInviteRemoved(input) {
      state.inviteRemovedCalls.push(input);
      if (!state.message) return null;
      state.message = {
        ...state.message,
        subjectSnapshot: input.subjectSnapshot,
        htmlSnapshot: input.htmlSnapshot,
        textSnapshot: input.textSnapshot,
        checksum: input.checksum,
        includedNewsletterInvite: false,
        version: state.message.version + 1,
      };
      return { id: state.message.id };
    },
    async recordSent(input) {
      state.sentCalls.push(input);
      if (state.sentShouldNoOp || !state.message) return null;
      state.message = { ...state.message, status: "sent" };
      return { engagementId: state.message.engagementId };
    },
    async markNewsletterInvited(engagementId, invitedAt) {
      state.newsletterInvited.push({ engagementId, invitedAt });
    },
  };
}

const fakeResend = {
  async send(message: { idempotencyKey: string; to: string }) {
    return { providerMessageId: `resend_${message.idempotencyKey}_${message.to}` };
  },
};

function createTestSender(state: FakeState) {
  return createClientThankYouTestSender({
    repository: createFakeRepository(state),
    resend: fakeResend,
    fromEmail: "hello@faithfulsoftwaresolutions.co.uk",
    founderEmail: "founder@faithfulsoftware.dev",
    now: () => fixedNow,
  });
}

function createSender(state: FakeState) {
  return createClientThankYouSender({
    repository: createFakeRepository(state),
    resend: fakeResend,
    fromEmail: "hello@faithfulsoftwaresolutions.co.uk",
    now: () => fixedNow,
  });
}

test("renderClientThankYouSnapshot includes the invitation only when requested", async () => {
  const withInvite = await renderClientThankYouSnapshot({
    firstName: "Ada",
    engagementName: "the enquiry portal build",
    includeNewsletterInvite: true,
  });
  assert.match(withInvite.html, /FSS Field Notes/);
  assert.ok(withInvite.html.includes(NEWSLETTER_OPT_IN_URL));
  assert.equal(withInvite.subject, "Thank you for trusting FSS with the enquiry portal build");

  const withoutInvite = await renderClientThankYouSnapshot({
    firstName: "Ada",
    engagementName: "the enquiry portal build",
    includeNewsletterInvite: false,
  });
  assert.doesNotMatch(withoutInvite.html, /FSS Field Notes/);
});

test("sends a founder test using the stored snapshot and records it", async () => {
  const state = createFakeState();
  const sendTest = createTestSender(state);

  const result = await sendTest(db, { messageId, founder, correlationId: "c" });

  assert.equal(result.testSentAt, fixedNow.toISOString());
  assert.equal(state.testSentCalls.length, 1);
  assert.equal(state.testSentCalls[0]?.version, 1);
});

test("a test send is rejected once the message has already been sent", async () => {
  const state = createFakeState({ message: baseRow({ status: "sent" }) });
  const sendTest = createTestSender(state);

  await assert.rejects(
    sendTest(db, { messageId, founder, correlationId: "c" }),
    (error: unknown) =>
      error instanceof ClientThankYouError && error.code === "not_testable",
  );
});

test("approves and sends the exact stored snapshot", async () => {
  const state = createFakeState();
  const send = createSender(state);

  const result = await send(db, {
    messageId,
    expectedVersion: 1,
    includeNewsletterInvite: true,
    founder,
    correlationId: "c",
  });

  assert.equal(result.sentAt, fixedNow.toISOString());
  assert.equal(state.sentCalls.length, 0 + 1);
  assert.equal(state.inviteRemovedCalls.length, 0);
  assert.equal(state.newsletterInvited.length, 1);
  assert.equal(state.newsletterInvited[0]?.engagementId, "22222222-2222-4222-8222-222222222222");
});

test("removing the invitation re-renders and persists a narrower snapshot before sending", async () => {
  const state = createFakeState();
  const send = createSender(state);

  await send(db, {
    messageId,
    expectedVersion: 1,
    includeNewsletterInvite: false,
    founder,
    correlationId: "c",
  });

  assert.equal(state.inviteRemovedCalls.length, 1);
  assert.doesNotMatch(state.inviteRemovedCalls[0]?.htmlSnapshot ?? "", /FSS Field Notes/);
  assert.equal(state.newsletterInvited.length, 0);
});

test("cannot add an invitation the stored snapshot never had", async () => {
  const state = createFakeState({
    message: baseRow({ includedNewsletterInvite: false }),
  });
  const send = createSender(state);

  await send(db, {
    messageId,
    expectedVersion: 1,
    includeNewsletterInvite: true,
    founder,
    correlationId: "c",
  });

  assert.equal(state.inviteRemovedCalls.length, 0);
  assert.equal(state.newsletterInvited.length, 0);
});

test("rejects sending an already-sent message", async () => {
  const state = createFakeState({ message: baseRow({ status: "sent" }) });
  const send = createSender(state);

  await assert.rejects(
    send(db, {
      messageId,
      expectedVersion: 1,
      includeNewsletterInvite: true,
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof ClientThankYouError && error.code === "not_approvable",
  );
});

test("rejects a stale version", async () => {
  const state = createFakeState({ message: baseRow({ version: 2 }) });
  const send = createSender(state);

  await assert.rejects(
    send(db, {
      messageId,
      expectedVersion: 1,
      includeNewsletterInvite: true,
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof ClientThankYouError && error.code === "version_conflict",
  );
});

test("rejects a suppressed recipient", async () => {
  const state = createFakeState({ suppressed: true });
  const send = createSender(state);

  await assert.rejects(
    send(db, {
      messageId,
      expectedVersion: 1,
      includeNewsletterInvite: true,
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof ClientThankYouError && error.code === "suppressed_contact",
  );
});

test("a concurrent second send is not treated as a failure", async () => {
  const state = createFakeState({ sentShouldNoOp: true });
  const send = createSender(state);

  const result = await send(db, {
    messageId,
    expectedVersion: 1,
    includeNewsletterInvite: true,
    founder,
    correlationId: "c",
  });

  assert.equal(result.messageId, messageId);
  assert.equal(state.newsletterInvited.length, 0);
});

test("rejects an unknown message", async () => {
  const state = createFakeState({ message: null });
  const send = createSender(state);

  await assert.rejects(
    send(db, {
      messageId,
      expectedVersion: 1,
      includeNewsletterInvite: true,
      founder,
      correlationId: "c",
    }),
    (error: unknown) =>
      error instanceof ClientThankYouError && error.code === "not_found",
  );
});
