import assert from "node:assert/strict";
import test from "node:test";
import {
  requireSafeReplay,
  commandProviderId,
  commandInvoiceId,
} from "./command-repository";
import { stripeAmount } from "./stripe-obligation";
test("expired uncertain commands require reconciliation instead of creating a fresh charge", () => {
  const now = Date.parse("2026-09-08T12:00:00Z");
  assert.throws(
    () => requireSafeReplay("2026-09-07T12:00:00Z", now),
    /reconciliation/,
  );
  assert.doesNotThrow(() => requireSafeReplay("2026-09-08T11:00:00Z", now));
  assert.equal(
    commandProviderId({
      id: "one",
      createdAt: "",
      target: "",
      result: { providerId: "in_existing" },
    }),
    "in_existing",
  );
});
test("Stripe adapter rejects lossy or unsupported pence amounts", () => {
  assert.equal(stripeAmount("12000"), 12000);
  assert.throws(() => stripeAmount("999999999999999999"), /range/);
});

test("durable command result retains original invoice identity with legacy safe absence", () => {
  const completed = {
    id: "command",
    target: "schedule",
    createdAt: "",
    result: { providerId: "sub_original", invoiceId: "in_original" },
  };
  assert.equal(commandInvoiceId(completed), "in_original");
  assert.equal(
    commandInvoiceId({ ...completed, result: { providerId: "sub_legacy" } }),
    null,
  );
});
