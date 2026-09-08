import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import {
  createBillingWebhookHandler,
  MAX_BILLING_WEBHOOK_BYTES,
  type BillingWebhookDependencies,
} from "./billing-webhook-handler";
const secret = "whsec_syntheticTask8";
const payload = JSON.stringify({
  id: "evt_syntheticTask8",
  object: "event",
  type: "invoice.paid",
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: { object: { id: "in_syntheticTask8" } },
});
function setup(overrides: Partial<BillingWebhookDependencies> = {}) {
  const receipts: unknown[] = [];
  return {
    receipts,
    handler: createBillingWebhookHandler({
      enabled: true,
      createCorrelationId: () => "correlation",
      configuration: () => ({
        accountId: "acct_syntheticTask8",
        mode: "test",
        secret,
      }),
      record: async (receipt) => {
        receipts.push(receipt);
        return "recorded";
      },
      reportUnexpectedError: () => {},
      ...overrides,
    }),
  };
}
function request(body = payload, headers: Record<string, string> = {}) {
  return new Request("https://fss.test/api/webhooks/operations/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret,
      }),
      ...headers,
    },
    body,
  });
}
test("webhook acknowledges only after durable receipt and treats duplicate delivery as success", async () => {
  const { handler, receipts } = setup();
  const response = await handler(request());
  assert.equal(response.status, 202);
  assert.equal(receipts.length, 1);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (await setup({ record: async () => "duplicate" }).handler(request()))
      .status,
    200,
  );
});
test("disabled, unconfigured and invalid signatures cannot record events", async () => {
  const disabled = setup({ enabled: false });
  assert.equal((await disabled.handler(request())).status, 404);
  assert.equal(disabled.receipts.length, 0);
  const unavailable = setup({
    configuration: () => {
      throw Error("private configuration");
    },
  });
  const response = await unavailable.handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private/);
  assert.equal(unavailable.receipts.length, 0);
  const invalid = setup();
  assert.equal(
    (await invalid.handler(request(payload, { "stripe-signature": "bad" })))
      .status,
    400,
  );
  assert.equal(
    (await invalid.handler(request(payload, { "content-type": "text/plain" })))
      .status,
    415,
  );
  assert.equal(invalid.receipts.length, 0);
});
test("a durable receipt timeout returns retryable failure without leaking provider details", async () => {
  const response = await setup({
    record: async () => {
      throw Error("database password and provider payload");
    },
  }).handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false });
});
test("body limits apply to streamed bytes even without Content-Length", async () => {
  const { handler, receipts } = setup();
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(MAX_BILLING_WEBHOOK_BYTES + 1));
    },
    cancel() {
      canceled = true;
    },
  });
  const init = {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "bad" },
    body,
    duplex: "half",
  };
  assert.equal(
    (await handler(new Request("https://fss.test/webhook", init))).status,
    413,
  );
  assert.equal(canceled, true);
  assert.equal(receipts.length, 0);
  assert.equal(
    (
      await handler(
        request(payload, {
          "content-length": String(MAX_BILLING_WEBHOOK_BYTES + 1),
        }),
      )
    ).status,
    413,
  );
});
