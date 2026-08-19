import assert from "node:assert/strict";
import test from "node:test";

import { Webhook } from "svix";

import type { AuditInput } from "../../audit/service";
import { SequenceStopError, type StopSequenceInput, type StoppedSequence } from "../../sequences/stop";
import type { EmailSuppressionDependencies } from "../../email/suppression";
import {
  applyResendWebhookEvent,
  handleResendWebhook,
  parseResendWebhookPayload,
  verifyResendWebhookSignature,
  type ResendDeliveryEventInput,
  type ResendWebhookDependencies,
  type ResendWebhookHeaders,
  type ResendWebhookRepository,
} from "./webhook";

const SECRET = Buffer.from("resend-webhook-test-secret-value").toString("base64");
const MSG_ID = "msg_2abc123def456";

function signedHeaders(body: string, timestamp: Date = new Date()): ResendWebhookHeaders {
  const signature = new Webhook(SECRET).sign(MSG_ID, timestamp, body);
  return {
    "svix-id": MSG_ID,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

function bouncedPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "email.bounced",
    created_at: "2026-08-19T09:00:00.000Z",
    data: { email_id: "resend-message-1", to: "reader@example.test", bounce: { type: "Permanent" } },
    ...overrides,
  };
}

type GlobalSuppressionCall = { normalisedEmail: string; reason: "bounce" | "do_not_contact"; source: string; createdBy: string };

type FakeState = {
  events: Map<string, ResendDeliveryEventInput>;
  enrollmentsByEmail: Map<string, string[]>;
  suppressionStatuses: Map<string, { status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained" }>;
  suppressionCalls: Array<{ email: string; status: "bounced" | "complained" }>;
  cancelCalls: Array<{ email: string; errorCode: string }>;
  stopCalls: StopSequenceInput[];
  stopThrows?: (input: StopSequenceInput) => Error | undefined;
  auditCalls: AuditInput[];
  globalSuppressionCalls: GlobalSuppressionCall[];
  throwOnGlobalSuppressionOnce?: boolean;
};

function createFakeState(): FakeState {
  return {
    events: new Map(),
    enrollmentsByEmail: new Map(),
    suppressionStatuses: new Map(),
    suppressionCalls: [],
    cancelCalls: [],
    stopCalls: [],
    auditCalls: [],
    globalSuppressionCalls: [],
  };
}

function createFakeRepository(state: FakeState): ResendWebhookRepository {
  return {
    async hasDeliveryEvent(providerEventId) {
      return state.events.has(providerEventId);
    },
    async recordDeliveryEvent(input) {
      if (state.events.has(input.providerEventId)) {
        return { inserted: false };
      }
      state.events.set(input.providerEventId, input);
      return { inserted: true };
    },
    async findSequenceEnrollmentIdsByEmail(normalisedEmail) {
      return state.enrollmentsByEmail.get(normalisedEmail) ?? [];
    },
    async insertGlobalSuppression(input) {
      state.globalSuppressionCalls.push(input);
      if (state.throwOnGlobalSuppressionOnce) {
        state.throwOnGlobalSuppressionOnce = false;
        throw new Error("suppression insert failed");
      }
    },
  };
}

function createFakeDeps(state: FakeState): ResendWebhookDependencies {
  const suppression: EmailSuppressionDependencies = {
    async findSubscriberStatusByEmail(normalisedEmail) {
      return state.suppressionStatuses.get(normalisedEmail) ?? null;
    },
    async upsertSuppressedStatus(normalisedEmail, status) {
      state.suppressionCalls.push({ email: normalisedEmail, status });
      state.suppressionStatuses.set(normalisedEmail, { status });
    },
  };

  return {
    repository: createFakeRepository(state),
    suppression,
    async cancelQueuedSendsForEmail(normalisedEmail, errorCode) {
      state.cancelCalls.push({ email: normalisedEmail, errorCode });
      return { cancelledIssueIds: [] };
    },
    async stopSequence(input): Promise<StoppedSequence> {
      state.stopCalls.push(input);
      const error = state.stopThrows?.(input);
      if (error) throw error;
      return { sequenceId: input.sequenceId, status: "stopped", alreadyApplied: false };
    },
    async appendAuditEvent(input) {
      state.auditCalls.push(input);
    },
  };
}

test("verifies a validly signed payload", () => {
  const body = JSON.stringify(bouncedPayload());
  const headers = signedHeaders(body);

  const result = verifyResendWebhookSignature(body, headers, SECRET);

  assert.equal(result.ok, true);
});

test("rejects a payload whose body was modified after signing", () => {
  const body = JSON.stringify(bouncedPayload());
  const headers = signedHeaders(body);
  const tamperedBody = JSON.stringify(bouncedPayload({ data: { email_id: "different", to: "reader@example.test" } }));

  const result = verifyResendWebhookSignature(tamperedBody, headers, SECRET);

  assert.equal(result.ok, false);
});

test("rejects a request missing a required svix header", () => {
  const body = JSON.stringify(bouncedPayload());
  const headers = signedHeaders(body);

  const result = verifyResendWebhookSignature(body, { ...headers, "svix-signature": null }, SECRET);

  assert.equal(result.ok, false);
});

test("rejects a signature built from an expired timestamp", () => {
  const body = JSON.stringify(bouncedPayload());
  const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes, outside svix's 5-minute tolerance
  const headers = signedHeaders(body, staleTimestamp);

  const result = verifyResendWebhookSignature(body, headers, SECRET);

  assert.equal(result.ok, false);
});

test("parses an unknown event type through the generic fallback schema", () => {
  const payload = bouncedPayload({ type: "email.some_future_event" });

  const result = parseResendWebhookPayload(payload);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.event.type, "email.some_future_event");
  }
});

test("logs an unknown event type for idempotency but does not attempt suppression", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload({ type: "email.some_future_event" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = await applyResendWebhookEvent(parsed.event, "evt_1", deps);

  assert.equal(result.duplicate, false);
  assert.equal(state.events.size, 1);
  assert.equal(state.suppressionCalls.length, 0);
  assert.equal(state.cancelCalls.length, 0);
});

test("a replayed provider event is a no-op the second time", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const first = await applyResendWebhookEvent(parsed.event, "evt_replay", deps);
  const second = await applyResendWebhookEvent(parsed.event, "evt_replay", deps);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  // Suppression side effects ran exactly once, not twice.
  assert.equal(state.suppressionCalls.length, 1);
  assert.equal(state.cancelCalls.length, 1);
});

test("a delivered event arriving after a bounce does not re-trigger suppression", async () => {
  // "Out-of-order delivery" mainly matters here as "don't double-process" —
  // only bounced/complained trigger suppression in this design, and nothing
  // un-suppresses, so a later `delivered` event is simply a no-op event log
  // entry regardless of arrival order.
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const bounced = parseResendWebhookPayload(bouncedPayload());
  const delivered = parseResendWebhookPayload(bouncedPayload({ type: "email.delivered" }));
  assert.equal(bounced.ok, true);
  assert.equal(delivered.ok, true);
  if (!bounced.ok || !delivered.ok) return;

  await applyResendWebhookEvent(bounced.event, "evt_bounce", deps);
  await applyResendWebhookEvent(delivered.event, "evt_delivered", deps);

  assert.equal(state.suppressionCalls.length, 1);
  assert.equal(state.suppressionStatuses.get("reader@example.test")?.status, "bounced");
});

test("a hard bounce records the bounce, cancels queued sends, and stops matching sequences", async () => {
  const state = createFakeState();
  state.enrollmentsByEmail.set("reader@example.test", ["11111111-1111-4111-8111-111111111111"]);
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  await applyResendWebhookEvent(parsed.event, "evt_bounce", deps);

  assert.deepEqual(state.suppressionCalls, [{ email: "reader@example.test", status: "bounced" }]);
  assert.equal(state.cancelCalls.length, 1);
  assert.equal(state.cancelCalls[0]?.email, "reader@example.test");
  assert.equal(state.stopCalls.length, 1);
  assert.equal(state.stopCalls[0]?.reason, "bounce");
  assert.equal(state.stopCalls[0]?.sequenceId, "11111111-1111-4111-8111-111111111111");
  assert.equal(state.auditCalls.length, 1);
  assert.deepEqual(state.globalSuppressionCalls, [
    { normalisedEmail: "reader@example.test", reason: "bounce", source: "resend_webhook", createdBy: "evt_bounce" },
  ]);
});

test("a hard bounce with zero matching enrollments still writes a global suppression row", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  await applyResendWebhookEvent(parsed.event, "evt_bounce", deps);

  assert.equal(state.stopCalls.length, 0);
  assert.deepEqual(state.globalSuppressionCalls, [
    { normalisedEmail: "reader@example.test", reason: "bounce", source: "resend_webhook", createdBy: "evt_bounce" },
  ]);
});

test("a transient bounce is recorded but does not trigger suppression", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload({ data: { email_id: "resend-message-1", to: "reader@example.test", bounce: { type: "Transient" } } }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const first = await applyResendWebhookEvent(parsed.event, "evt_transient", deps);
  const second = await applyResendWebhookEvent(parsed.event, "evt_transient", deps);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(state.suppressionCalls.length, 0);
  assert.equal(state.cancelCalls.length, 0);
  assert.equal(state.stopCalls.length, 0);
  assert.equal(state.globalSuppressionCalls.length, 0);
});

test("a mid-fan-out failure leaves the event unrecorded so a retry re-attempts suppression", async () => {
  const state = createFakeState();
  state.throwOnGlobalSuppressionOnce = true;
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  await assert.rejects(() => applyResendWebhookEvent(parsed.event, "evt_bounce", deps));

  assert.equal(state.events.size, 0);
  assert.equal(state.globalSuppressionCalls.length, 1);

  const result = await applyResendWebhookEvent(parsed.event, "evt_bounce", deps);

  assert.equal(result.duplicate, false);
  assert.equal(state.globalSuppressionCalls.length, 2);
  assert.equal(state.events.size, 1);
});

test("a complaint records the complaint and stops matching sequences with do_not_contact", async () => {
  const state = createFakeState();
  state.enrollmentsByEmail.set("reader@example.test", ["22222222-2222-4222-8222-222222222222"]);
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload({ type: "email.complained" }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  await applyResendWebhookEvent(parsed.event, "evt_complaint", deps);

  assert.deepEqual(state.suppressionCalls, [{ email: "reader@example.test", status: "complained" }]);
  assert.equal(state.stopCalls[0]?.reason, "do_not_contact");
});

test("an already-stopped enrollment is skipped without failing the webhook", async () => {
  const state = createFakeState();
  state.enrollmentsByEmail.set("reader@example.test", ["33333333-3333-4333-8333-333333333333"]);
  state.stopThrows = () => new SequenceStopError("already_stopped");
  const deps = createFakeDeps(state);
  const parsed = parseResendWebhookPayload(bouncedPayload());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const result = await applyResendWebhookEvent(parsed.event, "evt_bounce", deps);

  assert.equal(result.duplicate, false);
});

test("handleResendWebhook end to end: valid signature applies the event", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const body = JSON.stringify(bouncedPayload());
  const headers = signedHeaders(body);

  const result = await handleResendWebhook({ rawBody: body, headers, secret: SECRET }, deps);

  assert.deepEqual(result, { status: "applied", duplicate: false });
});

test("handleResendWebhook: missing secret configuration fails closed as unauthorized", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const body = JSON.stringify(bouncedPayload());
  const headers = signedHeaders(body);

  const result = await handleResendWebhook({ rawBody: body, headers, secret: undefined }, deps);

  assert.deepEqual(result, { status: "unauthorized" });
});

test("handleResendWebhook: invalid signature is reported the same as a missing one", async () => {
  const state = createFakeState();
  const deps = createFakeDeps(state);
  const body = JSON.stringify(bouncedPayload());

  const result = await handleResendWebhook(
    { rawBody: body, headers: { "svix-id": null, "svix-timestamp": null, "svix-signature": null }, secret: SECRET },
    deps,
  );

  assert.deepEqual(result, { status: "unauthorized" });
});

// Note: Resend's event catalog has no `email.unsubscribed` webhook event —
// unsubscribes are handled by the dedicated signed-token route
// (app/api/newsletter/unsubscribe/route.ts), not by this webhook. There is
// no real event type to test here.
