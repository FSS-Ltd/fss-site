import assert from "node:assert/strict";
import test from "node:test";
import { collectionsDecision } from "./collections";
const unpaid = {
  status: "open",
  amountRemainingPence: "6000",
  processing: false,
  disputed: false,
  held: false,
  overdueDays: 14,
  method: "card",
  failureCode: null,
} as const;
test("collections only queues founder review and suppresses resolved or protected invoices", () => {
  assert.equal(collectionsDecision(unpaid), "overdue_review");
  for (const state of [
    { status: "paid" },
    { status: "void" },
    { amountRemainingPence: "0" },
    { processing: true },
    { disputed: true },
    { held: true },
  ])
    assert.equal(collectionsDecision({ ...unpaid, ...state }), null);
});
test("method specific recovery never issues another debit or email", () => {
  assert.equal(
    collectionsDecision({
      ...unpaid,
      overdueDays: 1,
      method: "bacs_debit",
      failureCode: "insufficient_funds",
      mandateState: "active",
    }),
    "provider_retry_review",
  );
  assert.equal(
    collectionsDecision({
      ...unpaid,
      overdueDays: 1,
      method: "bacs_debit",
      failureCode: "debit_not_authorized",
    }),
    "new_mandate_required",
  );
  assert.equal(
    collectionsDecision({
      ...unpaid,
      overdueDays: 1,
      failureCode: "authentication_required",
    }),
    "payment_method_required",
  );
  assert.equal(collectionsDecision({ ...unpaid, overdueDays: 1 }), null);
});

test("inactive or pending mandates override insufficient-funds recovery, and reminders stay provider-owned", () => {
  assert.equal(
    collectionsDecision({
      ...unpaid,
      method: "bacs_debit",
      failureCode: "insufficient_funds",
      mandateState: "inactive",
    }),
    "new_mandate_required",
  );
  assert.equal(
    collectionsDecision({
      ...unpaid,
      method: "bacs_debit",
      failureCode: "insufficient_funds",
      mandateState: "pending",
    }),
    null,
  );
});
