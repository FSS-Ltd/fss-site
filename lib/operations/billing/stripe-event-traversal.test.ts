import assert from "node:assert/strict";
import test from "node:test";
import { createStripeReconciliationProvider } from "./stripe-reconciliation";
import { clientFixture, scope } from "./stripe-reconciliation-test-fixtures";
function eventFixture(
  object: string,
  objectId: string,
  overrides: Record<string, unknown> = {},
) {
  const eventType = `${object}.updated`;
  const fixture = clientFixture({
    "/v1/events/evt_test": {
      id: "evt_test",
      type: eventType,
      livemode: false,
      data: { object: { id: objectId, object } },
    },
    ...overrides,
  });
  const receipt = {
    ...scope,
    eventId: "evt_test",
    eventType,
    objectId,
    occurredAt: "2026-09-01T00:00:00.000Z",
    payloadHash: "a".repeat(64),
  };
  return {
    ...fixture,
    receipt,
    provider: createStripeReconciliationProvider(fixture.client, scope),
  };
}
test("every payment-side event follows the current provider references back to its invoice", async () => {
  const cases = [
    {
      object: "invoice_payment",
      id: "inpay_test",
      path: "/v1/invoice_payments/inpay_test",
      response: { livemode: false, invoice: { id: "in_test" } },
    },
    { object: "payment_intent", id: "pi_test" },
    { object: "charge", id: "ch_test" },
    {
      object: "refund",
      id: "re_test",
      path: "/v1/refunds/re_test",
      response: { payment_intent: { id: "pi_test" } },
    },
    {
      object: "dispute",
      id: "dp_test",
      path: "/v1/disputes/dp_test",
      response: { livemode: false, payment_intent: "pi_test" },
    },
    {
      object: "credit_note",
      id: "cn_test",
      path: "/v1/credit_notes/cn_test",
      response: { livemode: false, invoice: "in_test" },
    },
  ];
  for (const item of cases) {
    const f = eventFixture(
      item.object,
      item.id,
      item.path ? { [item.path]: item.response } : {},
    );
    assert.deepEqual(
      await f.provider.resolveEvent(f.receipt),
      { invoiceIds: ["in_test"], mandate: null },
      item.object,
    );
    assert.equal(f.requests[0], "/v1/events/evt_test");
  }
});
test("mandate and setup events resolve current mandate status without retaining acceptance details", async () => {
  for (const object of ["mandate", "setup_intent"]) {
    const f = eventFixture(
      object,
      object === "mandate" ? "mandate_test" : "seti_test",
      {
        "/v1/setup_intents/seti_test": {
          livemode: false,
          mandate: { id: "mandate_test" },
        },
      },
    );
    const result = await f.provider.resolveEvent(f.receipt);
    assert.deepEqual(result.invoiceIds, []);
    assert.equal(result.mandate?.status, "active");
    assert.equal(JSON.stringify(result).includes("sensitive"), false);
  }
  const f = eventFixture("setup_intent", "seti_test", {
    "/v1/setup_intents/seti_test": { livemode: false, mandate: null },
  });
  assert.equal((await f.provider.resolveEvent(f.receipt)).mandate, null);
});
test("subscription events reconcile issued invoices and ignore drafts", async () => {
  const f = eventFixture("subscription", "sub_test", {
    "/v1/subscriptions/sub_test": { id: "sub_test", livemode: false },
    "/v1/invoices": {
      data: [
        { id: "in_paid", status: "paid" },
        { id: "in_draft", status: "draft" },
      ],
      has_more: false,
    },
  });
  assert.deepEqual((await f.provider.resolveEvent(f.receipt)).invoiceIds, [
    "in_paid",
  ]);
  f.records["/v1/invoices"] = { data: [], has_more: true };
  await assert.rejects(
    f.provider.resolveEvent(f.receipt),
    /incomplete_provider_data/,
  );
});
test("unsupported legacy mappings and wrong account relationships enter review", async () => {
  for (const item of [
    { object: "charge", id: "ch_test", path: "/v1/charges/ch_test" },
    { object: "refund", id: "re_test", path: "/v1/refunds/re_test" },
    { object: "dispute", id: "dp_test", path: "/v1/disputes/dp_test" },
  ]) {
    const f = eventFixture(item.object, item.id, {
      [item.path]: { livemode: false, payment_intent: null },
    });
    await assert.rejects(f.provider.resolveEvent(f.receipt), /unknown_mapping/);
  }
  const f = eventFixture("payment_intent", "pi_test", {
    "/v1/invoice_payments": { data: [], has_more: true },
  });
  await assert.rejects(
    f.provider.resolveEvent(f.receipt),
    /incomplete_provider_data/,
  );
  for (const patch of [
    { accountId: "acct_other" },
    { mode: "live" as const },
    { eventType: "invoice.paid" },
  ])
    await assert.rejects(
      f.provider.resolveEvent({ ...f.receipt, ...patch }),
      /scope_mismatch/,
    );
  f.records["/v1/events/evt_test"] = {
    type: f.receipt.eventType,
    account: "acct_other",
    livemode: false,
    data: { object: { id: "pi_test", object: "payment_intent" } },
  };
  await assert.rejects(f.provider.resolveEvent(f.receipt), /scope_mismatch/);
});
test("daily listing follows an advancing cursor, including draft-only pages, and validates mode", async () => {
  const f = eventFixture("customer", "cus_test", {
    "/v1/invoices": {
      data: [
        { id: "in_draft", status: "draft", livemode: false },
        { id: "in_paid", status: "paid", livemode: false },
      ],
      has_more: true,
    },
  });
  assert.deepEqual(await f.provider.listInvoices(null, 2), {
    invoiceIds: ["in_paid"],
    cursor: "in_paid",
  });
  f.records["/v1/invoices"] = {
    data: [{ id: "in_draft", status: "draft", livemode: false }],
    has_more: false,
  };
  assert.deepEqual(await f.provider.listInvoices("in_paid", 2), {
    invoiceIds: [],
    cursor: null,
  });
  f.records["/v1/invoices"] = {
    data: [{ id: "in_live", status: "paid", livemode: true }],
    has_more: false,
  };
  await assert.rejects(f.provider.listInvoices(null, 2), /scope_mismatch/);
  assert.deepEqual(await f.provider.resolveEvent(f.receipt), {
    invoiceIds: [],
    mandate: null,
  });
  assert.equal(
    (await f.provider.fetchInvoice("in_test")).invoice.id,
    "in_test",
  );
});
