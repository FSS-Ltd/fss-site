import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { verifyUnsubscribeToken } from "../email/suppression";
import type { ResendGateway } from "../integrations/resend/client";
import {
  canTransitionNewsletterIssue,
  createFounderTestSender,
  createIssueApprover,
  createIssueApproveAndScheduler,
  createIssueScheduler,
  NewsletterIssueError,
  UNSUBSCRIBE_URL_PLACEHOLDER,
  type NewsletterIssueDependencies,
  type NewsletterIssueRow,
} from "./issues";

const founder: FounderSession = {
  email: "j.ntagengwa@faithfulsoftware.dev",
  actorId: "a".repeat(64),
};
function createFakeDb(): GrowthDb {
  const tag = (async () => []) as unknown as GrowthDb;
  (tag as unknown as { json: (value: unknown) => unknown }).json = (value) => value;
  return tag;
}

const FAKE_DB = createFakeDb();
const NOW = new Date("2026-08-19T09:00:00.000Z");
const UNSUBSCRIBE_TOKEN_SECRET = "s".repeat(32);
const SITE_ORIGIN = "https://faithfulsoftwaresolutions.co.uk";

function issueRow(overrides: Partial<NewsletterIssueRow> = {}): NewsletterIssueRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    status: "draft",
    subject: "Field Notes #1",
    htmlSnapshot: `<html><body><p>Body</p><a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a></body></html>`,
    textSnapshot: `Body\nUnsubscribe: ${UNSUBSCRIBE_URL_PLACEHOLDER}`,
    testSentAt: null,
    testSentVersion: null,
    approvedAt: null,
    approvedBy: null,
    approvedChecksum: null,
    scheduledFor: null,
    ...overrides,
  };
}

test("canTransitionNewsletterIssue allows the linear draft-to-sent chain", () => {
  assert.equal(canTransitionNewsletterIssue("draft", "ready_for_review"), true);
  assert.equal(canTransitionNewsletterIssue("ready_for_review", "approved"), true);
  assert.equal(canTransitionNewsletterIssue("approved", "scheduled"), true);
  assert.equal(canTransitionNewsletterIssue("scheduled", "sending"), true);
  assert.equal(canTransitionNewsletterIssue("sending", "sent"), true);
});

test("canTransitionNewsletterIssue rejects skipping a step", () => {
  assert.equal(canTransitionNewsletterIssue("draft", "approved"), false);
  assert.equal(canTransitionNewsletterIssue("ready_for_review", "scheduled"), false);
});

test("canTransitionNewsletterIssue allows failed and cancelled from any non-terminal state", () => {
  for (const from of ["draft", "ready_for_review", "approved", "scheduled", "sending"] as const) {
    assert.equal(canTransitionNewsletterIssue(from, "failed"), true);
    assert.equal(canTransitionNewsletterIssue(from, "cancelled"), true);
  }
});

test("canTransitionNewsletterIssue rejects any transition out of a terminal state", () => {
  for (const from of ["sent", "failed", "cancelled"] as const) {
    for (const to of [
      "draft",
      "ready_for_review",
      "approved",
      "scheduled",
      "sending",
      "sent",
      "failed",
      "cancelled",
    ] as const) {
      assert.equal(canTransitionNewsletterIssue(from, to), false);
    }
  }
});

type FakeState = {
  issue: NewsletterIssueRow | null;
  subscribedCount: number;
  testSends: Array<{ issueId: string; version: number; providerMessageId: string }>;
};

function createFakeRepository(state: FakeState): NewsletterIssueDependencies {
  return {
    async getIssueById(issueId) {
      return state.issue && state.issue.id === issueId ? state.issue : null;
    },
    async recordTestSent(input) {
      state.testSends.push(input);
      if (state.issue) {
        state.issue = {
          ...state.issue,
          testSentAt: input.testSentAt,
          testSentVersion: input.version,
        };
      }
    },
    async countSubscribedRecipients() {
      return state.subscribedCount;
    },
    async approveIssue(input) {
      if (!state.issue || state.issue.version !== input.expectedVersion) return null;
      state.issue = {
        ...state.issue,
        status: "approved",
        approvedAt: input.approvedAt,
        approvedBy: input.approvedBy,
        approvedChecksum: input.approvedChecksum,
      };
      return state.issue;
    },
    async scheduleIssue(input) {
      if (!state.issue || state.issue.version !== input.expectedVersion) return null;
      state.issue = {
        ...state.issue,
        status: "scheduled",
        scheduledFor: input.scheduledFor,
      };
      return state.issue;
    },
  };
}

test("sendFounderTest sends the exact pending snapshot to the founder only", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "ready_for_review" }),
    subscribedCount: 0,
    testSends: [],
  };
  const sentMessages: Array<Parameters<ResendGateway["send"]>[0]> = [];
  const resend: Pick<ResendGateway, "send"> = {
    async send(message) {
      sentMessages.push(message);
      return { providerMessageId: "provider-test-1" };
    },
  };

  const sendFounderTest = createFounderTestSender({
    repository: createFakeRepository(state),
    resend,
    fromEmail: "newsletter@faithfulsoftware.dev",
    founderEmail: founder.email,
    unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
    siteOrigin: SITE_ORIGIN,
    now: () => NOW,
  });

  const result = await sendFounderTest(FAKE_DB, {
    issueId: state.issue!.id,
    founder,
    correlationId: "corr-1",
  });

  assert.equal(result.providerMessageId, "provider-test-1");
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0]?.to, founder.email);
  assert.equal(sentMessages[0]?.replyTo, founder.email);
  assert.equal(state.testSends.length, 1);
  assert.equal(state.testSends[0]?.version, 1);
});

test("sendFounderTest substitutes the unsubscribe placeholder with a working link for the founder", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "ready_for_review" }),
    subscribedCount: 0,
    testSends: [],
  };
  const sentMessages: Array<Parameters<ResendGateway["send"]>[0]> = [];
  const resend: Pick<ResendGateway, "send"> = {
    async send(message) {
      sentMessages.push(message);
      return { providerMessageId: "provider-test-1" };
    },
  };

  const sendFounderTest = createFounderTestSender({
    repository: createFakeRepository(state),
    resend,
    fromEmail: "newsletter@faithfulsoftware.dev",
    founderEmail: founder.email,
    unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
    siteOrigin: SITE_ORIGIN,
    now: () => NOW,
  });

  await sendFounderTest(FAKE_DB, {
    issueId: state.issue!.id,
    founder,
    correlationId: "corr-1",
  });

  const sentHtml = sentMessages[0]?.html ?? "";
  const sentText = sentMessages[0]?.text ?? "";
  assert.equal(sentHtml.includes(UNSUBSCRIBE_URL_PLACEHOLDER), false);
  assert.equal(sentText.includes(UNSUBSCRIBE_URL_PLACEHOLDER), false);

  const [, tokenFromHtml] = /token=([^"&\s]+)/.exec(sentHtml) ?? [];
  assert.ok(tokenFromHtml, "expected an unsubscribe token in the sent html");
  const verified = verifyUnsubscribeToken(
    decodeURIComponent(tokenFromHtml!),
    UNSUBSCRIBE_TOKEN_SECRET,
    NOW,
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.ok && verified.normalisedEmail, founder.email.toLowerCase());
});

test("sendFounderTest rejects an issue that no longer exists", async () => {
  const state: FakeState = { issue: null, subscribedCount: 0, testSends: [] };
  const sendFounderTest = createFounderTestSender({
    repository: createFakeRepository(state),
    resend: { send: async () => ({ providerMessageId: "x" }) },
    fromEmail: "newsletter@faithfulsoftware.dev",
    founderEmail: founder.email,
    unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
    siteOrigin: SITE_ORIGIN,
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      sendFounderTest(FAKE_DB, {
        issueId: "missing",
        founder,
        correlationId: "corr-1",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "not_found",
  );
});

test("sendFounderTest rejects a terminal-status issue", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "sent" }),
    subscribedCount: 0,
    testSends: [],
  };
  const sendFounderTest = createFounderTestSender({
    repository: createFakeRepository(state),
    resend: { send: async () => ({ providerMessageId: "x" }) },
    fromEmail: "newsletter@faithfulsoftware.dev",
    founderEmail: founder.email,
    unsubscribeTokenSecret: UNSUBSCRIBE_TOKEN_SECRET,
    siteOrigin: SITE_ORIGIN,
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      sendFounderTest(FAKE_DB, {
        issueId: state.issue!.id,
        founder,
        correlationId: "corr-1",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "not_testable",
  );
});

test("approveIssue stores the checksum of the current snapshot and the founder actor id", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "ready_for_review" }),
    subscribedCount: 0,
    testSends: [],
  };
  const approveIssue = createIssueApprover({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  const updated = await approveIssue(FAKE_DB, {
    issueId: state.issue!.id,
    expectedVersion: 1,
    founder,
    correlationId: "corr-2",
  });

  assert.equal(updated.status, "approved");
  assert.equal(updated.approvedBy, founder.actorId);
  assert.match(updated.approvedChecksum ?? "", /^[0-9a-f]{64}$/);
});

test("approveIssue rejects an issue not in ready_for_review", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "draft" }),
    subscribedCount: 0,
    testSends: [],
  };
  const approveIssue = createIssueApprover({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      approveIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        founder,
        correlationId: "corr-2",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "invalid_transition",
  );
});

test("approveIssue rejects a stale expected version", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "ready_for_review", version: 2 }),
    subscribedCount: 0,
    testSends: [],
  };
  const approveIssue = createIssueApprover({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      approveIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        founder,
        correlationId: "corr-2",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "version_conflict",
  );
});

function approvedIssueRow(overrides: Partial<NewsletterIssueRow> = {}): NewsletterIssueRow {
  const base = issueRow({
    status: "approved",
    testSentAt: NOW,
    testSentVersion: 1,
  });
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    approvedChecksum:
      overrides.approvedChecksum ??
      createHash("sha256")
        .update(`\n${merged.htmlSnapshot}\n${merged.textSnapshot}`)
        .digest("hex"),
  };
}

test("scheduleIssue transitions approved to scheduled for a future UTC time", async () => {
  const state: FakeState = {
    issue: approvedIssueRow(),
    subscribedCount: 1,
    testSends: [],
  };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  const scheduledFor = new Date(NOW.getTime() + 60 * 60 * 1000);
  const updated = await scheduleIssue(FAKE_DB, {
    issueId: state.issue!.id,
    expectedVersion: 1,
    scheduledFor,
    founder,
    correlationId: "corr-3",
  });

  assert.equal(updated.status, "scheduled");
  assert.deepEqual(updated.scheduledFor, scheduledFor);
});

test("scheduleIssue blocks a stale expected version", async () => {
  const state: FakeState = { issue: approvedIssueRow(), subscribedCount: 1, testSends: [] };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 99,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "version_conflict",
  );
});

test("scheduleIssue blocks scheduling when the founder test was never sent for this version", async () => {
  const state: FakeState = {
    issue: approvedIssueRow({ testSentAt: null, testSentVersion: null }),
    subscribedCount: 1,
    testSends: [],
  };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "test_not_sent",
  );
});

test("scheduleIssue blocks scheduling when the founder test is stale against the current version", async () => {
  const state: FakeState = {
    issue: approvedIssueRow({ testSentVersion: 0 }),
    subscribedCount: 1,
    testSends: [],
  };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "test_not_sent",
  );
});

test("scheduleIssue blocks scheduling when there are no currently consented recipients", async () => {
  const state: FakeState = { issue: approvedIssueRow(), subscribedCount: 0, testSends: [] };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "missing_consent",
  );
});

test("scheduleIssue blocks scheduling when the snapshot has no unsubscribe link", async () => {
  const state: FakeState = {
    issue: approvedIssueRow({
      htmlSnapshot: "<html><body><p>Body with no unsubscribe link</p></body></html>",
      textSnapshot: "Body with no unsubscribe link",
    }),
    subscribedCount: 1,
    testSends: [],
  };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "missing_unsubscribe_link",
  );
});

test("scheduleIssue rejects a scheduled time that is not in the future", async () => {
  const state: FakeState = { issue: approvedIssueRow(), subscribedCount: 1, testSends: [] };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: NOW,
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "invalid_schedule_time",
  );
});

test("approveAndSchedule approves a ready_for_review issue then schedules it", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "ready_for_review" }),
    subscribedCount: 1,
    testSends: [],
  };
  // The founder test must have been sent for the current version before scheduling.
  state.issue = { ...state.issue!, testSentAt: NOW, testSentVersion: 1 };
  const approveAndSchedule = createIssueApproveAndScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  const scheduledFor = new Date(NOW.getTime() + 60 * 60 * 1000);
  const updated = await approveAndSchedule(FAKE_DB, {
    issueId: state.issue.id,
    expectedVersion: 1,
    scheduledFor,
    founder,
    correlationId: "corr-4",
  });

  assert.equal(updated.status, "scheduled");
  assert.equal(updated.approvedBy, founder.actorId);
  assert.deepEqual(updated.scheduledFor, scheduledFor);
});

test("approveAndSchedule schedules directly when the issue is already approved", async () => {
  const state: FakeState = {
    issue: approvedIssueRow(),
    subscribedCount: 1,
    testSends: [],
  };
  const approveAndSchedule = createIssueApproveAndScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  const scheduledFor = new Date(NOW.getTime() + 60 * 60 * 1000);
  const updated = await approveAndSchedule(FAKE_DB, {
    issueId: state.issue!.id,
    expectedVersion: 1,
    scheduledFor,
    founder,
    correlationId: "corr-4",
  });

  assert.equal(updated.status, "scheduled");
});

test("approveAndSchedule rejects an issue that cannot be approved or scheduled", async () => {
  const state: FakeState = {
    issue: issueRow({ status: "draft" }),
    subscribedCount: 1,
    testSends: [],
  };
  const approveAndSchedule = createIssueApproveAndScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      approveAndSchedule(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-4",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "invalid_transition",
  );
});

test("scheduleIssue rejects an approval checksum stale against the current snapshot", async () => {
  const state: FakeState = {
    issue: approvedIssueRow({ approvedChecksum: "f".repeat(64) }),
    subscribedCount: 1,
    testSends: [],
  };
  const scheduleIssue = createIssueScheduler({
    repository: createFakeRepository(state),
    now: () => NOW,
  });

  await assert.rejects(
    () =>
      scheduleIssue(FAKE_DB, {
        issueId: state.issue!.id,
        expectedVersion: 1,
        scheduledFor: new Date(NOW.getTime() + 60_000),
        founder,
        correlationId: "corr-3",
      }),
    (error: unknown) =>
      error instanceof NewsletterIssueError && error.code === "checksum_mismatch",
  );
});
