import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("exported Operations webhook is gated and rejects invalid signatures before opening a database", async () => {
  const names = [
    "OPERATIONS_ENABLED",
    "OPERATIONS_BILLING_ENABLED",
    "STRIPE_MODE",
    "STRIPE_SECRET_KEY",
    "STRIPE_ACCOUNT_ID",
    "OPERATIONS_STRIPE_WEBHOOK_SECRET",
    "OPERATIONS_BILLING_DATABASE_URL",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  const request = () =>
    new Request("https://fss.test/api/webhooks/operations/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "invalid",
      },
      body: "{}",
    });
  try {
    process.env.OPERATIONS_ENABLED = "false";
    assert.equal((await POST(request())).status, 404);
    Object.assign(process.env, {
      OPERATIONS_ENABLED: "true",
      OPERATIONS_BILLING_ENABLED: "true",
      STRIPE_MODE: "test",
      STRIPE_SECRET_KEY: "sk_test_synthetic",
      STRIPE_ACCOUNT_ID: "acct_synthetic",
      OPERATIONS_STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
    });
    delete process.env.OPERATIONS_BILLING_DATABASE_URL;
    const response = await POST(request());
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    for (const [name, value] of previous)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
