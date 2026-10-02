import Stripe from "stripe";
import { BILLING_STRIPE_API_VERSION } from "./client";
export const scope = { accountId: "acct_test", mode: "test" as const };
export function clientFixture(overrides: Record<string, unknown> = {}) {
  const requests: string[] = [];
  const invoice = {
    id: "in_test",
    object: "invoice",
    livemode: false,
    currency: "gbp",
    customer: "cus_test",
    status: "paid",
    amount_due: 6000,
    amount_overpaid: 0,
    amount_paid: 6000,
    amount_remaining: 0,
    total: 6000,
    lines: { data: [], has_more: false },
    parent: null,
  };
  const records: Record<string, unknown> = {
    "/v1/events/evt_test": {
      id: "evt_test",
      type: "invoice.paid",
      livemode: false,
      data: { object: invoice },
    },
    "/v1/invoices/in_test": invoice,
    "/v1/invoice_payments": {
      data: [
        {
          id: "inpay_test",
          livemode: false,
          currency: "gbp",
          invoice: "in_test",
          amount_paid: 6000,
          payment: { type: "payment_intent", payment_intent: "pi_test" },
          status_transitions: { paid_at: 1788220800 },
        },
      ],
      has_more: false,
    },
    "/v1/payment_intents/pi_test": {
      id: "pi_test",
      livemode: false,
      customer: "cus_test",
      currency: "gbp",
      amount: 6000,
      amount_received: 6000,
      status: "succeeded",
      latest_charge: "ch_test",
      created: 1788220800,
      last_payment_error: null,
    },
    "/v1/charges/ch_test": {
      currency: "gbp",
      id: "ch_test",
      livemode: false,
      customer: "cus_test",
      payment_intent: "pi_test",
      created: 1788220800,
      payment_method_details: {
        type: "bacs_debit",
        bacs_debit: {
          mandate: "mandate_test",
          sort_code: "sensitive",
          last4: "1234",
        },
      },
    },
    "/v1/refunds": {
      data: [
        {
          id: "re_test",
          currency: "gbp",
          charge: "ch_test",
          payment_intent: "pi_test",
          amount: 1000,
          status: "succeeded",
        },
      ],
      has_more: false,
    },
    "/v1/disputes": {
      data: [
        {
          id: "dp_test",
          currency: "gbp",
          livemode: false,
          payment_intent: "pi_test",
          amount: 2000,
          status: "needs_response",
        },
      ],
      has_more: false,
    },
    "/v1/mandates/mandate_test": {
      id: "mandate_test",
      livemode: false,
      payment_method: "pm_test",
      status: "active",
      customer_acceptance: { online: { ip_address: "sensitive" } },
    },
    "/v1/payment_methods/pm_test": {
      id: "pm_test",
      livemode: false,
      customer: "cus_test",
      bacs_debit: { sort_code: "sensitive", last4: "1234" },
    },
    "/v1/credit_notes": {
      data: [
        {
          id: "cn_test",
          currency: "gbp",
          livemode: false,
          invoice: "in_test",
          amount: 500,
          status: "issued",
        },
      ],
      has_more: false,
    },
    ...overrides,
  };
  const client = new Stripe("sk_test_synthetic", {
    apiVersion: BILLING_STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (url) => {
      const path = new URL(String(url)).pathname;
      requests.push(path);
      if (!(path in records))
        throw new Error(`Unexpected fixture request ${path}`);
      return new Response(JSON.stringify(records[path]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  });
  return { client, requests, invoice, records };
}
