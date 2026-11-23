import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "svix";
import { createResendOutreachWebhookHandler } from "./handler";

const secret = Buffer.from("synthetic-scoped-webhook-secret").toString(
  "base64",
);
const binding = {
  team: "team",
  environment: "production" as const,
  sender: "sender@example.test",
  domain: "example.test",
  replyTo: "reply@example.test",
  sendGeneration: "11111111-1111-4111-8111-111111111111",
  usageGeneration: "22222222-2222-4222-8222-222222222222",
  webhookGeneration: "33333333-3333-4333-8333-333333333333",
};
const connectionId = "44444444-4444-4444-8444-444444444444";
const event = {
  type: "email.delivered",
  created_at: "2026-11-23T12:00:00.000Z",
  data: {
    email_id: "provider-1",
    message_id: "<actual@example.test>",
    from: "sender@example.test",
    to: ["owner@example.test"],
  },
};
const receipt = {
  basis: "resend_fss_delivery_observed" as const,
  providerMessageId: "provider-1",
  providerEventId: "event-1",
  bodySha256: "a".repeat(64),
  rfcMessageId: "<actual@example.test>",
  connectionId,
  webhookGeneration: binding.webhookGeneration,
  sendGeneration: binding.sendGeneration,
  providerEventCreatedAt: event.created_at,
  providerMessageCreatedAt: null,
  observedAt: event.created_at,
  possibleInvocationFrom: event.created_at,
};
function request(payload: unknown, key = secret): Request {
  const raw = JSON.stringify(payload),
    timestamp = new Date(),
    eventId = "event-1";
  return new Request("https://example.test/api/webhooks/resend/outreach", {
    method: "POST",
    body: raw,
    headers: {
      "svix-id": eventId,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": new Webhook(key).sign(eventId, timestamp, raw),
    },
  });
}

test("authenticates exact scoped raw body before looking up any account", async () => {
  let resolutions = 0,
    confirmations = 0;
  const handler = createResendOutreachWebhookHandler({
    readConfiguration: () => ({ binding, webhookSecret: secret }),
    resolveConnection: async () => {
      resolutions++;
      return connectionId;
    },
    confirm: async (_config, id, raw) => {
      confirmations++;
      assert.equal(id, connectionId);
      assert.equal(raw, JSON.stringify(event));
      return {
        status: "ready",
        value: { reservationId: "test", receipt, replay: confirmations > 1 },
      };
    },
  });
  const other = Buffer.from("wrong-webhook-secret").toString("base64");
  const denied = await handler(request(event, other));
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { ok: false, code: "unauthorized" });
  assert.equal(resolutions, 0);
  assert.equal(confirmations, 0);
  for (let i = 0; i < 2; i++) {
    const accepted = await handler(request(event));
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { ok: true, code: "recorded" });
  }
  assert.equal(resolutions, 2);
  assert.equal(confirmations, 2);
});

test("holds unconfigured, unrecognized, unsafe or unresolved requests", async () => {
  let calls = 0;
  const dependencies = {
    readConfiguration: () => ({ binding, webhookSecret: secret }),
    resolveConnection: async () => {
      calls++;
      return connectionId;
    },
    confirm: async () => ({
      status: "held" as const,
      reason: "issuer_unknown",
    }),
  };
  const handler = createResendOutreachWebhookHandler(dependencies);
  assert.equal(
    (
      await createResendOutreachWebhookHandler({
        ...dependencies,
        readConfiguration: () => null,
      })(request(event))
    ).status,
    503,
  );
  assert.equal(
    (await handler(request({ ...event, type: "email.opened" }))).status,
    422,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await handler(
        request({
          ...event,
          data: { ...event.data, to: ["a@example.test", "b@example.test"] },
        }),
      )
    ).status,
    422,
  );
  const pending = await handler(request(event));
  assert.equal(pending.status, 503);
  assert.deepEqual(await pending.json(), {
    ok: false,
    code: "receipt_pending",
  });
  const ambiguous = createResendOutreachWebhookHandler({
    ...dependencies,
    resolveConnection: async () => null,
  });
  assert.equal((await ambiguous(request(event))).status, 503);
  const conflict = createResendOutreachWebhookHandler({
    ...dependencies,
    confirm: async () => ({ status: "held", reason: "delivery_conflict" }),
  });
  const held = await conflict(request(event));
  assert.equal(held.status, 409);
  assert.deepEqual(await held.json(), { ok: false, code: "receipt_conflict" });
});

test("enforces the byte limit and returns redacted errors", async () => {
  const errors: unknown[] = [];
  const handler = createResendOutreachWebhookHandler({
    readConfiguration: () => ({ binding, webhookSecret: secret }),
    resolveConnection: async () => {
      throw new Error("private account data");
    },
    confirm: async () => ({ status: "held", reason: "unused" }),
    reportUnexpectedError: (error) => errors.push(error),
  });
  const big = new Request("https://example.test/api/webhooks/resend/outreach", {
    method: "POST",
    body: "{}",
    headers: { "content-length": "1048577" },
  });
  assert.equal((await handler(big)).status, 413);
  const error = await handler(request(event));
  assert.equal(error.status, 503);
  assert.deepEqual(await error.json(), {
    ok: false,
    code: "temporarily_unavailable",
  });
  assert.equal(errors.length, 1);
  const bytes = new Uint8Array([0xff]);
  const invalid = new Request(
    "https://example.test/api/webhooks/resend/outreach",
    { method: "POST", body: bytes },
  );
  assert.equal((await handler(invalid)).status, 400);
});

test("routes authenticated adverse events without invoking delivery confirmation", async () => {
  let calls = 0,
    deliveries = 0;
  const handler = createResendOutreachWebhookHandler({
    readConfiguration: () => ({ binding, webhookSecret: secret }),
    resolveConnection: async () => connectionId,
    confirm: async () => {
      deliveries++;
      return { status: "held", reason: "unused" };
    },
    adverse: async (_config, id, raw) => {
      calls++;
      assert.equal(id, connectionId);
      const payload = JSON.parse(raw) as { type: string };
      return {
        status: "ready",
        value: { ignored: payload.type === "email.bounced", replay: false },
      };
    },
  });
  const soft = await handler(
    request({
      ...event,
      type: "email.bounced",
      data: { ...event.data, bounce: { type: "Transient" } },
    }),
  );
  assert.equal(soft.status, 200);
  assert.deepEqual(await soft.json(), { ok: true, code: "ignored" });
  const complaint = await handler(
    request({ ...event, type: "email.complained" }),
  );
  assert.equal(complaint.status, 200);
  assert.deepEqual(await complaint.json(), { ok: true, code: "recorded" });
  assert.equal(calls, 2);
  assert.equal(deliveries, 0);
});
