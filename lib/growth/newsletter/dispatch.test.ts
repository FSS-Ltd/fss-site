import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import { verifyUnsubscribeToken } from "../email/suppression";
import { ResendClientError, type ResendGateway } from "../integrations/resend/client";
import { createNewsletterDispatcher } from "./dispatch";
import { UNSUBSCRIBE_URL_PLACEHOLDER } from "./issues";
import type {
  CancelNewsletterSendInput,
  ClaimedNewsletterSend,
  FailNewsletterSendInput,
  NewsletterDispatchRepository,
  NewsletterIssueSnapshot,
  NewsletterSendRecipient,
  RecordNewsletterSentInput,
} from "./newsletter-dispatch-repository";

const NOW = new Date("2026-08-19T09:00:00.000Z");
const db = {} as GrowthDb;
const UNSUBSCRIBE_TOKEN_SECRET = "s".repeat(32);
const SITE_ORIGIN = "https://faithfulsoftwaresolutions.co.uk";

function claimedSend(
  overrides: Partial<ClaimedNewsletterSend> = {},
): ClaimedNewsletterSend {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    previousStatus: "queued",
    newsletterIssueId: "22222222-2222-4222-8222-222222222222",
    subscriberId: "33333333-3333-4333-8333-333333333333",
    idempotencyKey:
      "newsletter:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333",
    attemptCount: 1,
    ...overrides,
  };
}

function issueSnapshot(
  overrides: Partial<NewsletterIssueSnapshot> = {},
): NewsletterIssueSnapshot {
  return {
    status: "sending",
    subject: "Field Notes #1",
    htmlSnapshot: `<html><body><p>Body</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a></body></html>`,
    textSnapshot: `Body\nUnsubscribe: ${UNSUBSCRIBE_URL_PLACEHOLDER}`,
    ...overrides,
  };
}

function recipient(
  overrides: Partial<NewsletterSendRecipient> = {},
): NewsletterSendRecipient {
  return {
    status: "subscribed",
    email: "reader@example.test",
    ...overrides,
  };
}

type FakeState = {
  seedCalls: number;
  seedResults: boolean[];
  queue: ClaimedNewsletterSend[];
  issues: Map<string, NewsletterIssueSnapshot>;
  recipients: Map<string, NewsletterSendRecipient>;
  cancels: CancelNewsletterSendInput[];
  fails: FailNewsletterSendInput[];
  sent: RecordNewsletterSentInput[];
};

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    seedCalls: 0,
    seedResults: [false],
    queue: [claimedSend()],
    issues: new Map([
      ["22222222-2222-4222-8222-222222222222", issueSnapshot()],
    ]),
    recipients: new Map([
      ["33333333-3333-4333-8333-333333333333", recipient()],
    ]),
    cancels: [],
    fails: [],
    sent: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): NewsletterDispatchRepository {
  return {
    async seedNextDueIssue() {
      const result = state.seedResults[state.seedCalls] ?? false;
      state.seedCalls += 1;
      return result;
    },
    async claimDueSend() {
      return state.queue.shift() ?? null;
    },
    async getIssueSnapshot(_db, newsletterIssueId) {
      return state.issues.get(newsletterIssueId) ?? null;
    },
    async getRecipient(_db, subscriberId) {
      return state.recipients.get(subscriberId) ?? null;
    },
    async cancelSend(_db, input) {
      state.cancels.push(input);
    },
    async failSend(_db, input) {
      state.fails.push(input);
    },
    async recordSent(_db, input) {
      state.sent.push(input);
    },
  };
}

function fakeResend(
  overrides: Partial<Pick<ResendGateway, "send">> = {},
): Pick<ResendGateway, "send"> {
  return {
    send: overrides.send ?? (async () => ({ providerMessageId: "provider-1" })),
  };
}

function createDispatch(
  state: FakeState,
  overrides: { resend?: Pick<ResendGateway, "send"> } = {},
) {
  return createNewsletterDispatcher({
    repository: createFakeRepository(state),
    resend: overrides.resend ?? fakeResend(),
    fromEmail: "newsletter@faithfulsoftware.dev",
    replyToEmail: "j.ntagengwa@faithfulsoftware.dev",
    unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
    siteOrigin: SITE_ORIGIN,
    now: () => NOW,
    createLeaseToken: () => "lease-token",
  });
}

test("sends a due newsletter send and records it as sent", async () => {
  const state = createFakeState();
  const dispatch = createDispatch(state);

  const summary = await dispatch(db);

  assert.deepEqual(summary, {
    seededIssues: 0,
    claimed: 1,
    sent: 1,
    cancelled: 0,
    retryableFailures: 0,
    permanentFailures: 0,
  });
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0]?.providerMessageId, "provider-1");
});

test("stops claiming once no sends are due", async () => {
  const state = createFakeState({ queue: [] });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db);

  assert.deepEqual(summary, {
    seededIssues: 0,
    claimed: 0,
    sent: 0,
    cancelled: 0,
    retryableFailures: 0,
    permanentFailures: 0,
  });
});

test("seeds due issues before claiming, bounded by the seed limit", async () => {
  const state = createFakeState({
    seedResults: [true, true, false],
    queue: [],
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db);

  assert.equal(summary.seededIssues, 2);
});

test("cancels a claimed send when the subscriber is no longer subscribed", async () => {
  const state = createFakeState({
    recipients: new Map([
      [
        "33333333-3333-4333-8333-333333333333",
        recipient({ status: "unsubscribed" }),
      ],
    ]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db);

  assert.equal(summary.cancelled, 1);
  assert.equal(state.cancels[0]?.errorCode, "suppressed_contact");
  assert.equal(state.sent.length, 0);
});

test("cancels a claimed send when the issue is no longer dispatchable", async () => {
  const state = createFakeState({
    issues: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        issueSnapshot({ status: "cancelled" }),
      ],
    ]),
  });
  const dispatch = createDispatch(state);

  const summary = await dispatch(db);

  assert.equal(summary.cancelled, 1);
  assert.equal(state.cancels[0]?.errorCode, "issue_not_dispatchable");
});

test("marks a retryable provider error for retry without spending a permanent failure", async () => {
  const state = createFakeState();
  const dispatch = createDispatch(state, {
    resend: fakeResend({
      send: async () => {
        throw new ResendClientError("RETRYABLE_PROVIDER_ERROR");
      },
    }),
  });

  const summary = await dispatch(db);

  assert.equal(summary.retryableFailures, 1);
  assert.equal(summary.permanentFailures, 0);
  assert.equal(state.fails[0]?.status, "retry");
});

test("marks a permanent provider error as failed", async () => {
  const state = createFakeState();
  const dispatch = createDispatch(state, {
    resend: fakeResend({
      send: async () => {
        throw new ResendClientError("PERMANENT_PROVIDER_ERROR");
      },
    }),
  });

  const summary = await dispatch(db);

  assert.equal(summary.permanentFailures, 1);
  assert.equal(state.fails[0]?.status, "failed");
});

test("sends the issue's pending snapshot with the configured reply-to", async () => {
  const state = createFakeState();
  const messages: Array<Parameters<ResendGateway["send"]>[0]> = [];
  const dispatch = createDispatch(state, {
    resend: fakeResend({
      send: async (message) => {
        messages.push(message);
        return { providerMessageId: "provider-1" };
      },
    }),
  });

  await dispatch(db);

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.to, "reader@example.test");
  assert.equal(messages[0]?.replyTo, "j.ntagengwa@faithfulsoftware.dev");
  assert.equal(messages[0]?.category, "newsletter");
  assert.equal(messages[0]?.idempotencyKey, claimedSend().idempotencyKey);
});

test("substitutes the unsubscribe placeholder with a link that verifies back to the recipient's own email", async () => {
  const state = createFakeState();
  const messages: Array<Parameters<ResendGateway["send"]>[0]> = [];
  const dispatch = createDispatch(state, {
    resend: fakeResend({
      send: async (message) => {
        messages.push(message);
        return { providerMessageId: "provider-1" };
      },
    }),
  });

  await dispatch(db);

  const sentHtml = messages[0]?.html ?? "";
  const sentText = messages[0]?.text ?? "";
  assert.equal(sentHtml.includes(UNSUBSCRIBE_URL_PLACEHOLDER), false);
  assert.equal(sentText.includes(UNSUBSCRIBE_URL_PLACEHOLDER), false);

  const [, tokenFromHtml] = /token=([^"&\s]+)/.exec(sentHtml) ?? [];
  const [, tokenFromText] = /token=([^\s]+)/.exec(sentText) ?? [];
  assert.ok(tokenFromHtml, "expected an unsubscribe token in the sent html");
  assert.ok(tokenFromText, "expected an unsubscribe token in the sent text");

  for (const rawToken of [tokenFromHtml, tokenFromText]) {
    const verified = verifyUnsubscribeToken(
      decodeURIComponent(rawToken!),
      UNSUBSCRIBE_TOKEN_SECRET,
      NOW,
    );
    assert.equal(verified.ok, true);
    assert.equal(verified.ok && verified.normalisedEmail, "reader@example.test");
  }
});

test("cancels a claimed send whose snapshot has no unsubscribe placeholder", async () => {
  const state = createFakeState({
    issues: new Map([
      [
        "22222222-2222-4222-8222-222222222222",
        issueSnapshot({
          htmlSnapshot: "<html><body><p>No placeholder here</p></body></html>",
          textSnapshot: "No placeholder here",
        }),
      ],
    ]),
  });
  const sent: unknown[] = [];
  const dispatch = createDispatch(state, {
    resend: fakeResend({
      send: async (message) => {
        sent.push(message);
        return { providerMessageId: "provider-1" };
      },
    }),
  });

  const summary = await dispatch(db);

  assert.equal(summary.cancelled, 1);
  assert.equal(sent.length, 0);
  assert.equal(state.cancels[0]?.errorCode, "missing_unsubscribe_placeholder");
});
