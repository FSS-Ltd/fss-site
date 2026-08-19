import assert from "node:assert/strict";
import test from "node:test";

import { Webhook } from "svix";

import type { ResendWebhookDependencies } from "@/lib/growth/integrations/resend/webhook";

import { createResendWebhookRouteHandler } from "./route";

const NOOP_DEPS: ResendWebhookDependencies = {
  repository: {
    async hasDeliveryEvent() {
      return false;
    },
    async recordDeliveryEvent() {
      return { inserted: true };
    },
    async findSequenceEnrollmentIdsByEmail() {
      return [];
    },
    async insertGlobalSuppression() {},
  },
  suppression: {
    async findSubscriberStatusByEmail() {
      return null;
    },
    async upsertSuppressedStatus() {},
  },
  async cancelQueuedSendsForEmail() {
    return { cancelledIssueIds: [] };
  },
  async stopSequence() {
    return { sequenceId: "x", status: "stopped", alreadyApplied: false };
  },
  async appendAuditEvent() {},
};

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://faithfulsoftwaresolutions.co.uk/api/webhooks/resend", {
    method: "POST",
    body,
    headers,
  });
}

function signedRequest(secret: string, payload: Record<string, unknown>): Request {
  const body = JSON.stringify(payload);
  const timestamp = new Date();
  const svixId = "msg_test";
  const signature = new Webhook(secret).sign(svixId, timestamp, body);
  return request(body, {
    "svix-id": svixId,
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  });
}

test("returns 401 with a generic body when the secret is not configured (fails closed)", async () => {
  const handler = createResendWebhookRouteHandler({ secret: undefined, deps: NOOP_DEPS });

  const response = await handler(request("{}"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { ok: false });
});

test("returns 401 with the same generic body for an unsigned or malformed request", async () => {
  const handler = createResendWebhookRouteHandler({ secret: "a-secret", deps: NOOP_DEPS });

  const response = await handler(request("not json at all"));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, { ok: false });
});

test("reads the raw body as text before parsing, so a validly signed event is applied", async () => {
  const secret = Buffer.from("route-test-secret").toString("base64");
  const handler = createResendWebhookRouteHandler({ secret, deps: NOOP_DEPS });

  const response = await handler(
    signedRequest(secret, {
      type: "email.delivered",
      created_at: "2026-08-19T09:00:00.000Z",
      data: { email_id: "resend-message-1", to: "reader@example.test" },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
});

test("acknowledges with 200 for a signed payload the parser does not recognise, to avoid a retry storm", async () => {
  const secret = Buffer.from("route-test-secret-2").toString("base64");
  const handler = createResendWebhookRouteHandler({ secret, deps: NOOP_DEPS });

  const response = await handler(
    signedRequest(secret, {
      type: "email.bounced",
      created_at: "not-a-valid-date",
      data: { email_id: "resend-message-2", to: "reader@example.test" },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
});

test("maps an unexpected dependency error to a 500 and reports it without leaking details", async () => {
  const secret = Buffer.from("route-test-secret-3").toString("base64");
  const reported: unknown[] = [];
  const handler = createResendWebhookRouteHandler({
    secret,
    deps: {
      ...NOOP_DEPS,
      repository: {
        async hasDeliveryEvent(): Promise<never> {
          throw new Error("db unavailable");
        },
        async recordDeliveryEvent() {
          return { inserted: true };
        },
        async findSequenceEnrollmentIdsByEmail() {
          return [];
        },
        async insertGlobalSuppression() {},
      },
    },
    reportUnexpectedError: (error) => reported.push(error),
  });

  const response = await handler(
    signedRequest(secret, {
      type: "email.bounced",
      created_at: "2026-08-19T09:00:00.000Z",
      data: { email_id: "resend-message-3", to: "reader@example.test" },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { ok: false });
  assert.equal(reported.length, 1);
});
