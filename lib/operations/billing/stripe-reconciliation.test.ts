import assert from "node:assert/strict";
import test from "node:test";
import { createStripeReconciliationProvider } from "./stripe-reconciliation";
import {
  fetchStripeInvoiceProjection,
  fetchStripeMandate,
} from "./stripe-projections";
import { clientFixture, scope } from "./stripe-reconciliation-test-fixtures";
test("authoritative SDK projections preserve payment/refund/dispute and only retain mandate reference/status", async () => {
  const { client } = clientFixture();
  const snapshot = await fetchStripeInvoiceProjection(client, scope, "in_test");
  assert.equal(snapshot.payments[0].receivedPence, "6000");
  assert.equal(snapshot.payments[0].allocationPence, "6000");
  assert.equal(snapshot.payments[0].refunds[0].amountPence, "1000");
  assert.equal(snapshot.payments[0].disputes[0].amountPence, "2000");
  assert.equal(snapshot.payments[0].providerMandateId, "mandate_test");
  assert.deepEqual(
    snapshot.mandates.map(({ providerId, customerId, status }) => ({
      providerId,
      customerId,
      status,
    })),
    [{ providerId: "mandate_test", customerId: "cus_test", status: "active" }],
  );
  assert.equal(JSON.stringify(snapshot).includes("sensitive"), false);
  assert.equal(snapshot.credits[0].amountPence, "500");
});
test("event is re-fetched using own account credentials and fails mismatched event/account/mode", async () => {
  const receipt = {
    ...scope,
    eventId: "evt_test",
    eventType: "invoice.paid",
    objectId: "in_test",
    occurredAt: "2026-09-01T00:00:00.000Z",
    payloadHash: "a".repeat(64),
  };
  const { client } = clientFixture();
  const provider = createStripeReconciliationProvider(client, scope);
  assert.deepEqual((await provider.resolveEvent(receipt)).invoiceIds, [
    "in_test",
  ]);
  await assert.rejects(
    provider.resolveEvent({ ...receipt, objectId: "in_other" }),
    /scope_mismatch/,
  );
  const wrong = clientFixture({
    "/v1/events/evt_test": {
      id: "evt_test",
      type: "invoice.paid",
      livemode: true,
      data: { object: { id: "in_test", object: "invoice" } },
    },
  });
  await assert.rejects(
    createStripeReconciliationProvider(wrong.client, scope).resolveEvent(
      receipt,
    ),
    /scope_mismatch/,
  );
});
test("bounded provider pages and mismatched customer/currency fail closed", async () => {
  for (const overrides of [
    { "/v1/invoice_payments": { data: [], has_more: true } },
    {
      "/v1/payment_intents/pi_test": {
        id: "pi_test",
        livemode: false,
        currency: "gbp",
        customer: "cus_wrong",
      },
    },
  ]) {
    const { client } = clientFixture(overrides);
    await assert.rejects(
      fetchStripeInvoiceProjection(client, scope, "in_test"),
      /incomplete_provider_data|scope_mismatch/,
    );
  }
  const { client } = clientFixture({
    "/v1/mandates/mandate_test": {
      id: "mandate_test",
      livemode: false,
      payment_method: "pm_test",
      status: "future_unknown",
    },
  });
  await assert.rejects(
    fetchStripeMandate(client, scope, "mandate_test"),
    /invalid_projection/,
  );
});
test("released subscription schedule is recovered without overwriting its stored provider reference", async () => {
  const fixture = clientFixture();
  fixture.records["/v1/invoices/in_test"] = {
    ...fixture.invoice,
    parent: { subscription_details: { subscription: "sub_test" } },
  };
  fixture.records["/v1/subscriptions/sub_test"] = {
    id: "sub_test",
    currency: "gbp",
    livemode: false,
    customer: "cus_test",
    schedule: null,
  };
  fixture.records["/v1/subscription_schedules"] = {
    data: [
      {
        id: "sub_sched_test",
        livemode: false,
        customer: "cus_test",
        released_subscription: "sub_test",
        subscription: null,
      },
    ],
    has_more: false,
  };
  assert.equal(
    (await fetchStripeInvoiceProjection(fixture.client, scope, "in_test"))
      .subscriptionScheduleId,
    "sub_sched_test",
  );
});
