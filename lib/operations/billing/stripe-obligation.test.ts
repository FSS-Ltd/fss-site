import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { BILLING_STRIPE_API_VERSION } from "./client";
import { createStripeObligation } from "./stripe-obligation";
import type { BillingSchedule } from "./domain-types";
function schedule(overrides: Partial<BillingSchedule> = {}): BillingSchedule {
  return {
    id: "schedule",
    organisationId: "org",
    accountId: "acct_test",
    mode: "test",
    currency: "GBP",
    agreementId: "agreement",
    revision: 1,
    key: "installment:1",
    owner: "invoice",
    amountPence: "6000",
    dueDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    recurrenceMonths: 0,
    description: "Signed installment",
    providerReference: null,
    ...overrides,
  };
}
const command = () => ({
  id: "command",
  createdAt: new Date().toISOString(),
  result: null,
  target: "schedule",
});
function providerFixture(timeout = false, currency = "gbp") {
  const requests: {
    path: string;
    params: URLSearchParams;
    key: string | null;
  }[] = [];
  let created = false;
  let item = false;
  let finalized = false;
  const invoice = () => ({
    id: "in_one",
    customer: "cus_one",
    livemode: false,
    currency,
    billing_reason: "subscription_create",
    status: finalized ? "open" : "draft",
    total: item ? 6000 : 0,
    metadata: { operations_command: "command" },
  });
  const stripe = new Stripe("sk_test_synthetic", {
    apiVersion: BILLING_STRIPE_API_VERSION,
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (url, init) => {
      const parsed = new URL(String(url));
      const path = parsed.pathname;
      const params = new URLSearchParams(
        typeof init?.body === "string" ? init.body : "",
      );
      requests.push({
        path,
        params,
        key: new Headers(init?.headers).get("idempotency-key"),
      });
      let result: unknown;
      if (path === "/v1/customers/cus_one")
        result = { id: "cus_one", livemode: false };
      else if (path === "/v1/invoices" && init?.method === "GET")
        result = { data: created ? [invoice()] : [], has_more: false };
      else if (path === "/v1/invoices" && init?.method === "POST") {
        created = true;
        if (timeout) {
          timeout = false;
          throw new Error("Network timeout after provider creation");
        }
        result = invoice();
      } else if (path === "/v1/invoiceitems" && init?.method === "GET")
        result = {
          data: item
            ? [{ id: "ii_one", metadata: { operations_command: "command" } }]
            : [],
          has_more: false,
        };
      else if (path === "/v1/invoiceitems") {
        item = true;
        result = { id: "ii_one" };
      } else if (path === "/v1/invoices/in_one/finalize") {
        finalized = true;
        result = invoice();
      } else if (path === "/v1/invoices/in_one") result = invoice();
      else if (path === "/v1/products") result = { id: "prod_one" };
      else if (path === "/v1/subscriptions" && init?.method === "GET")
        result = { data: [], has_more: false };
      else if (path === "/v1/subscriptions") {
        item = true;
        result = {
          id: "sub_one",
          currency,
          customer: "cus_one",
          livemode: false,
          latest_invoice: "in_one",
        };
      } else if (
        path === "/v1/subscription_schedules" &&
        init?.method === "GET"
      )
        result = { data: [], has_more: false };
      else if (path === "/v1/subscription_schedules")
        result = { id: "sub_sched_one" };
      else throw new Error(`Unexpected provider request ${path}`);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  });
  return { stripe, requests };
}
test("uncertain invoice creation recovers metadata before retry and finalizes once", async () => {
  const f = providerFixture(true);
  const c = command();
  await assert.rejects(
    createStripeObligation(f.stripe, schedule(), "cus_one", c),
  );
  const recovered = await createStripeObligation(
    f.stripe,
    schedule(),
    "cus_one",
    c,
  );
  assert.equal(recovered.providerId, "in_one");
  assert.equal(recovered.invoice?.total, 6000);
  const retried = await createStripeObligation(
    f.stripe,
    schedule(),
    "cus_one",
    { ...c, result: { providerId: "in_one" } },
  );
  assert.equal(retried.providerId, "in_one");
  assert.equal(
    f.requests.filter(
      (r) => r.path === "/v1/invoices" && r.params.has("customer"),
    ).length,
    1,
  );
  assert.equal(
    f.requests.filter((r) => r.path.endsWith("/finalize")).length,
    1,
  );
  assert.ok(
    f.requests.find(
      (r) => r.path === "/v1/invoiceitems" && r.params.get("amount") === "6000",
    ),
  );
});
test("start-now annual subscription owns and finalizes first invoice without standalone invoice", async () => {
  const f = providerFixture();
  await createStripeObligation(
    f.stripe,
    schedule({ owner: "subscription", recurrenceMonths: 12 }),
    "cus_one",
    command(),
  );
  const request = f.requests.find(
    (r) => r.path === "/v1/subscriptions" && r.params.has("customer"),
  );
  assert.equal(
    request?.params.get("items[0][price_data][recurring][interval_count]"),
    "12",
  );
  assert.equal(
    f.requests.filter(
      (r) => r.path === "/v1/invoices" && r.params.has("customer"),
    ).length,
    0,
  );
  assert.equal(
    f.requests.filter((r) => r.path.endsWith("/finalize")).length,
    1,
  );
});
test("future retainer schedules signed start separately and never creates an immediate invoice", async () => {
  const f = providerFixture();
  await createStripeObligation(
    f.stripe,
    schedule({
      owner: "subscription",
      recurrenceMonths: 1,
      dueDate: "2099-01-01",
    }),
    "cus_one",
    command(),
  );
  const request = f.requests.find(
    (r) => r.path === "/v1/subscription_schedules" && r.params.has("customer"),
  );
  assert.equal(
    request?.params.get("start_date"),
    String(Date.parse("2099-01-01T00:00:00Z") / 1000),
  );
  assert.equal(request?.params.get("end_behavior"), "release");
  assert.equal(
    f.requests.some((r) => r.path === "/v1/invoices"),
    false,
  );
});

test("completed subscription retry retrieves only the original invoice without finalization or latest subscription lookup", async () => {
  const f = providerFixture();
  const result = await createStripeObligation(
    f.stripe,
    schedule({ owner: "subscription", recurrenceMonths: 1 }),
    "cus_one",
    { ...command(), result: { providerId: "sub_one", invoiceId: "in_one" } },
  );
  assert.equal(result.invoice?.id, "in_one");
  assert.deepEqual(
    f.requests.map((request) => request.path),
    ["/v1/invoices/in_one"],
  );
});

test("issued USD and EUR obligations use the signed currency for invoice and price requests", async () => {
  for (const currency of ["USD", "EUR"] as const) {
    const f = providerFixture(false, currency.toLowerCase());
    const result = await createStripeObligation(
      f.stripe,
      schedule({ currency }),
      "cus_one",
      command(),
    );
    assert.equal(result.invoice?.currency, currency.toLowerCase());
    const invoiceWrite = f.requests.find(
      (item) => item.path === "/v1/invoices" && item.params.has("currency"),
    );
    const itemWrite = f.requests.find(
      (item) => item.path === "/v1/invoiceitems" && item.params.has("currency"),
    );
    assert.equal(invoiceWrite?.params.get("currency"), currency.toLowerCase());
    assert.equal(itemWrite?.params.get("currency"), currency.toLowerCase());
  }
});
test("a provider currency mismatch prevents issuing the signed obligation", async () => {
  const f = providerFixture();
  await assert.rejects(
    createStripeObligation(
      f.stripe,
      schedule({ currency: "USD" }),
      "cus_one",
      command(),
    ),
    /context mismatch/,
  );
});
