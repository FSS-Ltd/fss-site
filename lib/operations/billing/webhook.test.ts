import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import { verifyBillingWebhook } from "./webhook";
const secret = "whsec_syntheticTask8";
const accountId = "acct_syntheticTask8";
const now = Date.now();
const event = {
  id: "evt_syntheticTask8",
  object: "event",
  type: "invoice.paid",
  livemode: false,
  created: Math.floor(now / 1000),
  data: {
    object: {
      id: "in_syntheticTask8",
      customer: "cus_private",
      bank_details: "must not be persisted",
    },
  },
};
function signed(payload: object = event, timestamp = Math.floor(now / 1000)) {
  const raw = JSON.stringify(payload);
  return {
    raw: Buffer.from(raw),
    signature: Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret,
      timestamp,
    }),
  };
}
test("webhook verifies exact signed bytes and emits only a minimal durable receipt", () => {
  const { raw, signature } = signed();
  assert.deepEqual(
    verifyBillingWebhook(
      raw,
      signature,
      { secret, accountId, mode: "test" },
      now,
    ),
    {
      accountId,
      mode: "test",
      eventId: event.id,
      eventType: event.type,
      objectId: event.data.object.id,
      payloadHash: createHash("sha256").update(raw).digest("hex"),
      occurredAt: new Date(event.created * 1000).toISOString(),
    },
  );
});
test("invalid, tampered and expired signatures do not produce receipts", () => {
  const valid = signed();
  assert.equal(
    verifyBillingWebhook(
      valid.raw,
      null,
      { secret, accountId, mode: "test" },
      now,
    ),
    null,
  );
  assert.equal(
    verifyBillingWebhook(
      Buffer.from(valid.raw.toString() + " "),
      valid.signature,
      { secret, accountId, mode: "test" },
      now,
    ),
    null,
  );
  const expired = signed(event, Math.floor(now / 1000) - 600);
  assert.equal(
    verifyBillingWebhook(
      expired.raw,
      expired.signature,
      { secret, accountId, mode: "test" },
      now,
    ),
    null,
  );
  assert.equal(
    verifyBillingWebhook(
      valid.raw,
      valid.signature,
      { secret: "whsec_wrong", accountId, mode: "test" },
      now,
    ),
    null,
  );
});
test("signed wrong-mode, other-account and malformed events are rejected", () => {
  for (const payload of [
    { ...event, livemode: true },
    { ...event, account: "acct_other" },
    { ...event, object: "something_else" },
    { ...event, data: { object: {} } },
  ]) {
    const { raw, signature } = signed(payload);
    assert.equal(
      verifyBillingWebhook(
        raw,
        signature,
        { secret, accountId, mode: "test" },
        now,
      ),
      null,
    );
  }
  const { raw, signature } = signed({ ...event, account: accountId });
  assert.ok(
    verifyBillingWebhook(
      raw,
      signature,
      { secret, accountId, mode: "test" },
      now,
    ),
  );
});
