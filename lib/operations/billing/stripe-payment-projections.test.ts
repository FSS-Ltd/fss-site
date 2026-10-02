import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchStripeInvoiceProjection,
  fetchStripeMandate,
} from "./stripe-projections";
import { clientFixture, scope } from "./stripe-reconciliation-test-fixtures";
const intent = {
  id: "pi_test",
  livemode: false,
  customer: "cus_test",
  currency: "gbp",
  amount: 6000,
  amount_received: 0,
  status: "requires_payment_method",
  latest_charge: null,
  created: 1788220800,
  last_payment_error: null,
};
const allocation = {
  id: "inpay_test",
  livemode: false,
  currency: "gbp",
  invoice: "in_test",
  amount_paid: null,
  payment: { type: "payment_intent", payment_intent: { id: "pi_test" } },
  status_transitions: { paid_at: null },
};
test("asynchronous debit, card failure, cancellation and unpaid intent remain distinct from paid", async () => {
  for (const item of [
    {
      status: "processing",
      error: null,
      expected: "processing",
      method: "other",
      code: null,
    },
    {
      status: "canceled",
      error: null,
      expected: "canceled",
      method: "other",
      code: null,
    },
    {
      status: "requires_confirmation",
      error: null,
      expected: "pending",
      method: "other",
      code: null,
    },
    {
      status: "requires_payment_method",
      error: {
        decline_code: "authentication_required",
        code: "card_declined",
        payment_method: { type: "card" },
      },
      expected: "failed",
      method: "card",
      code: "authentication_required",
    },
    {
      status: "requires_payment_method",
      error: {
        code: "insufficient_funds",
        payment_method: { type: "bacs_debit" },
      },
      expected: "failed",
      method: "bacs_debit",
      code: "insufficient_funds",
    },
  ]) {
    const f = clientFixture({
      "/v1/payment_intents/pi_test": {
        ...intent,
        status: item.status,
        last_payment_error: item.error,
      },
      "/v1/invoice_payments": { data: [allocation], has_more: false },
      "/v1/disputes": { data: [], has_more: false },
    });
    const payment = (
      await fetchStripeInvoiceProjection(f.client, scope, "in_test")
    ).payments[0];
    assert.equal(payment.state, item.expected);
    assert.equal(payment.method, item.method);
    assert.equal(payment.failureCode, item.code);
    assert.equal(payment.confirmedAt, null);
    assert.equal(payment.allocationPence, "0");
    assert.deepEqual(payment.refunds, []);
  }
});
test("Bacs pending and inactive mandates preserve their exact state, and detached methods require mapping review", async () => {
  for (const status of ["inactive", "pending"]) {
    const f = clientFixture({
      "/v1/mandates/mandate_test": {
        id: "mandate_test",
        livemode: false,
        payment_method: { id: "pm_test" },
        status,
      },
    });
    assert.equal(
      (await fetchStripeMandate(f.client, scope, "mandate_test")).status,
      status,
    );
  }
  const f = clientFixture({
    "/v1/payment_methods/pm_test": {
      id: "pm_test",
      livemode: false,
      customer: null,
    },
  });
  await assert.rejects(
    fetchStripeMandate(f.client, scope, "mandate_test"),
    /unknown_mapping/,
  );
});
test("invalid money and inconsistent invoice/payment/adjustment ownership fail closed", async () => {
  const base = clientFixture();
  const cases: { overrides: Record<string, unknown>; error: RegExp }[] = [
    {
      overrides: { "/v1/invoices/in_test": { ...base.invoice, total: -1 } },
      error: /invalid_projection/,
    },
    {
      overrides: {
        "/v1/invoices/in_test": {
          ...base.invoice,
          total: Number.MAX_SAFE_INTEGER + 1,
        },
      },
      error: /invalid_projection/,
    },
    {
      overrides: {
        "/v1/invoices/in_test": { ...base.invoice, currency: "jpy" },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/invoices/in_test": { ...base.invoice, customer: null },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/invoice_payments": {
          data: [{ ...allocation, invoice: "in_other" }],
          has_more: false,
        },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/invoice_payments": {
          data: [
            {
              ...allocation,
              payment: { type: "payment_record", payment_record: "pr_test" },
            },
          ],
          has_more: false,
        },
      },
      error: /incomplete_provider_data/,
    },
    {
      overrides: {
        "/v1/invoice_payments": {
          data: [{ ...allocation, payment: { type: "payment_intent" } }],
          has_more: false,
        },
      },
      error: /incomplete_provider_data/,
    },
    {
      overrides: {
        "/v1/charges/ch_test": {
          livemode: false,
          payment_intent: null,
          customer: "cus_test",
        },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/charges/ch_test": {
          livemode: false,
          payment_intent: "pi_test",
          customer: null,
        },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/disputes": {
          data: [{ livemode: false, payment_intent: null }],
          has_more: false,
        },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/credit_notes": {
          data: [{ livemode: false, invoice: "in_other" }],
          has_more: false,
        },
      },
      error: /scope_mismatch/,
    },
    {
      overrides: {
        "/v1/payment_intents/pi_test": { ...intent, customer: null },
      },
      error: /scope_mismatch/,
    },
  ];
  for (const item of cases) {
    const f = clientFixture(item.overrides);
    await assert.rejects(
      fetchStripeInvoiceProjection(f.client, scope, "in_test"),
      item.error,
    );
  }
});
test("invoice lines are fetched completely and an active subscription schedule avoids released-schedule search", async () => {
  const f = clientFixture();
  f.records["/v1/invoices/in_test"] = {
    ...f.invoice,
    customer: { id: "cus_test" },
    lines: { data: [], has_more: true },
    parent: { subscription_details: { subscription: { id: "sub_test" } } },
  };
  f.records["/v1/invoices/in_test/lines"] = {
    data: [{ id: "il_test", currency: "gbp" }],
    has_more: false,
  };
  f.records["/v1/subscriptions/sub_test"] = {
    id: "sub_test",
    currency: "gbp",
    livemode: false,
    customer: { id: "cus_test" },
    schedule: { id: "sub_sched_test" },
  };
  assert.equal(
    (await fetchStripeInvoiceProjection(f.client, scope, "in_test"))
      .subscriptionScheduleId,
    "sub_sched_test",
  );
  assert.equal(f.requests.includes("/v1/subscription_schedules"), false);
  f.records["/v1/invoices/in_test/lines"] = { data: [], has_more: true };
  await assert.rejects(
    fetchStripeInvoiceProjection(f.client, scope, "in_test"),
    /incomplete_provider_data/,
  );
});
test("ambiguous schedule matches and cross-customer subscriptions cannot attach a renewal", async () => {
  const f = clientFixture();
  f.records["/v1/invoices/in_test"] = {
    ...f.invoice,
    parent: { subscription_details: { subscription: "sub_test" } },
  };
  f.records["/v1/subscriptions/sub_test"] = {
    id: "sub_test",
    currency: "gbp",
    livemode: false,
    customer: "cus_other",
    schedule: null,
  };
  await assert.rejects(
    fetchStripeInvoiceProjection(f.client, scope, "in_test"),
    /scope_mismatch/,
  );
  f.records["/v1/subscriptions/sub_test"] = {
    id: "sub_test",
    currency: "gbp",
    livemode: false,
    customer: "cus_test",
    schedule: null,
  };
  f.records["/v1/subscription_schedules"] = {
    data: [
      { id: "sub_sched_one", livemode: false, subscription: "sub_test" },
      {
        id: "sub_sched_two",
        livemode: false,
        released_subscription: "sub_test",
      },
    ],
    has_more: false,
  };
  await assert.rejects(
    fetchStripeInvoiceProjection(f.client, scope, "in_test"),
    /invalid_projection/,
  );
});

test("supported invoice currencies still reject cross-currency allocations", async () => {
  const f = clientFixture();
  f.records["/v1/invoices/in_test"] = { ...f.invoice, currency: "usd" };
  await assert.rejects(
    fetchStripeInvoiceProjection(f.client, scope, "in_test"),
    /scope_mismatch/,
  );
});

test("USD and EUR retain currency through payment and adjustment projections", async () => {
  for (const currency of ["usd", "eur"]) {
    const f = clientFixture();
    for (const path of [
      "/v1/invoices/in_test",
      "/v1/payment_intents/pi_test",
      "/v1/charges/ch_test",
    ]) {
      const value = f.records[path];
      if (typeof value === "object" && value !== null)
        f.records[path] = { ...value, currency };
    }
    for (const path of [
      "/v1/invoice_payments",
      "/v1/refunds",
      "/v1/disputes",
      "/v1/credit_notes",
    ]) {
      const value = f.records[path] as {
        data: Record<string, unknown>[];
        has_more: boolean;
      };
      f.records[path] = {
        ...value,
        data: value.data.map((item) => ({ ...item, currency })),
      };
    }
    const result = await fetchStripeInvoiceProjection(
      f.client,
      scope,
      "in_test",
    );
    assert.equal(result.payments[0].currency, currency.toUpperCase());
    assert.equal(
      result.payments[0].refunds[0].currency,
      currency.toUpperCase(),
    );
    assert.equal(result.credits[0].currency, currency.toUpperCase());
  }
});
