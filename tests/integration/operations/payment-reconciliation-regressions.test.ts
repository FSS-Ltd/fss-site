import assert from "node:assert/strict";
import test from "node:test";
import { reconcileBillingInvoice } from "../../../lib/operations/billing/reconciliation";
import type { BillingReconciliationProvider } from "../../../lib/operations/billing/reconciliation-types";
import {
  createReconciliationFixture,
  invoiceSnapshot,
} from "./payment-reconciliation-fixtures";

test("duplicate card/debit settlement retains both confirmed payments and separates applied funds from excess", async () => {
  const f = await createReconciliationFixture();
  const snapshot = invoiceSnapshot(f.invoiceIds[0], f.customerId);
  const provider: BillingReconciliationProvider = {
    scope: f.scope,
    async resolveEvent() {
      return { invoiceIds: [], mandate: null };
    },
    async fetchInvoice() {
      return structuredClone(snapshot);
    },
    async listInvoices() {
      return { invoiceIds: [], cursor: null };
    },
  };
  try {
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    snapshot.invoice.amount_paid = 12000;
    snapshot.invoice.amount_overpaid = 6000;
    snapshot.payments.push({
      ...snapshot.payments[0],
      currency: "GBP",
      providerId: `pi_debit${f.organisationId.replaceAll("-", "")}`,
      allocationId: `inpay_debit${f.organisationId.replaceAll("-", "")}`,
      method: "bacs_debit",
    });
    // Newest provider list order must not take allocation away from the already confirmed card.
    snapshot.payments.reverse();
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    const payments = await f.admin<
      { received: string }[]
    >`select received_pence::text as received from operations.payments where organisation_id=${f.organisationId}`;
    assert.deepEqual(
      payments.map((p) => p.received),
      ["6000", "6000"],
    );
    const allocation = await f.admin<
      { applied: string; providerPaid: string; excess: string }[]
    >`select amount_pence::text as applied,provider_paid_pence::text as "providerPaid",excess_pence::text as excess from operations.payment_allocations where organisation_id=${f.organisationId} order by amount_pence desc`;
    assert.deepEqual(
      [...allocation],
      [
        { applied: "6000", providerPaid: "6000", excess: "0" },
        { applied: "0", providerPaid: "6000", excess: "6000" },
      ],
    );
    assert.equal(
      (
        await f.admin`select id from operations.billing_exceptions where organisation_id=${f.organisationId} and category='overpayment_review'`
      ).length,
      1,
    );
    snapshot.payments[0].allocationPence = "7000";
    await assert.rejects(
      reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id),
      /over-allocation|immutable/,
    );
  } finally {
    await f.cleanup();
  }
});

test("positive starting balance permits provider amount due greater than original invoice total", async () => {
  const f = await createReconciliationFixture();
  const snapshot = invoiceSnapshot(f.invoiceIds[0], f.customerId);
  snapshot.invoice.amount_due = 9000;
  snapshot.invoice.amount_paid = 9000;
  snapshot.invoice.starting_balance = 3000;
  snapshot.payments[0].amountPence = "9000";
  snapshot.payments[0].receivedPence = "9000";
  snapshot.payments[0].allocationPence = "9000";
  const provider: BillingReconciliationProvider = {
    scope: f.scope,
    async resolveEvent() {
      return { invoiceIds: [], mandate: null };
    },
    async fetchInvoice() {
      return structuredClone(snapshot);
    },
    async listInvoices() {
      return { invoiceIds: [], cursor: null };
    },
  };
  try {
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    const [row] = await f.admin<
      { total: string; due: string; overpaid: string }[]
    >`select total_pence::text as total,amount_due_pence::text as due,amount_overpaid_pence::text as overpaid from operations.invoices where organisation_id=${f.organisationId}`;
    assert.deepEqual(row, { total: "6000", due: "9000", overpaid: "0" });
    const [allocation] = await f.admin<
      { amount: string }[]
    >`select amount_pence::text as amount from operations.payment_allocations where organisation_id=${f.organisationId}`;
    assert.equal(allocation.amount, "9000");
  } finally {
    await f.cleanup();
  }
});

test("newer shared-payment refund and dispute observations survive reversed commits across two invoice workers", async () => {
  const f = await createReconciliationFixture();
  const older = invoiceSnapshot(f.invoiceIds[0], f.customerId);
  const newer = invoiceSnapshot(f.invoiceIds[1], f.customerId);
  const sharedId = older.payments[0].providerId;
  for (const snapshot of [older, newer]) {
    snapshot.payments[0].providerId = sharedId;
    snapshot.payments[0].amountPence = "12000";
    snapshot.payments[0].receivedPence = "12000";
    snapshot.payments[0].refunds = [
      {
        currency: "GBP",
        providerId: `re_${f.organisationId.replaceAll("-", "")}`,
        amountPence: "1000",
        status: "pending",
      },
    ];
    snapshot.payments[0].disputes = [
      {
        currency: "GBP",
        providerId: `dp_${f.organisationId.replaceAll("-", "")}`,
        amountPence: "3000",
        status: "needs_response",
      },
    ];
  }
  newer.payments[0].observedAt = "2026-09-02T00:00:00.000Z";
  newer.payments[0].refunds[0].status = "succeeded";
  newer.payments[0].disputes[0].status = "won";
  let releaseOld: () => void = () => {};
  let capturedOld: () => void = () => {};
  const release = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const captured = new Promise<void>((resolve) => {
    capturedOld = resolve;
  });
  const base = {
    scope: f.scope,
    async resolveEvent() {
      return { invoiceIds: [], mandate: null };
    },
    async listInvoices() {
      return { invoiceIds: [], cursor: null };
    },
  };
  const oldProvider: BillingReconciliationProvider = {
    ...base,
    async fetchInvoice() {
      const value = structuredClone(older);
      capturedOld();
      await release;
      return value;
    },
  };
  const newProvider: BillingReconciliationProvider = {
    ...base,
    async fetchInvoice() {
      return structuredClone(newer);
    },
  };
  const first = reconcileBillingInvoice(
    f.worker,
    oldProvider,
    older.invoice.id,
  );
  try {
    await captured;
    await reconcileBillingInvoice(f.worker, newProvider, newer.invoice.id);
    releaseOld();
    await first;
    const [refund] = await f.admin<
      { status: string }[]
    >`select status from operations.payment_refunds where organisation_id=${f.organisationId}`;
    const [dispute] = await f.admin<
      { status: string }[]
    >`select status from operations.payment_disputes where organisation_id=${f.organisationId}`;
    assert.equal(refund.status, "succeeded");
    assert.equal(dispute.status, "won");
    const [payment] = await f.admin<
      { state: string; observedAt: string }[]
    >`select state,projected_at::text as "observedAt" from operations.payments where organisation_id=${f.organisationId}`;
    assert.equal(payment.state, "succeeded");
    assert.equal(
      new Date(payment.observedAt).toISOString(),
      newer.payments[0].observedAt,
    );
    const [allocated] = await f.admin<
      { amount: string }[]
    >`select sum(provider_paid_pence)::text as amount from operations.payment_allocations where organisation_id=${f.organisationId}`;
    assert.equal(allocated.amount, "12000");
  } finally {
    releaseOld();
    await first.catch(() => {});
    await f.cleanup();
  }
});

test("mandate observation ordering and separate credit evidence remain intact for an uncollectible invoice", async () => {
  const f = await createReconciliationFixture();
  const snapshot = invoiceSnapshot(f.invoiceIds[0], f.customerId);
  snapshot.invoice.status = "uncollectible";
  snapshot.invoice.amount_paid = 0;
  snapshot.invoice.amount_remaining = 5000;
  snapshot.payments[0].state = "failed";
  snapshot.payments[0].receivedPence = "0";
  snapshot.payments[0].allocationPence = "0";
  snapshot.payments[0].confirmedAt = null;
  snapshot.payments[0].method = "bacs_debit";
  snapshot.payments[0].failureCode = "insufficient_funds";
  const mandateId = `mandate_${f.organisationId.replaceAll("-", "")}`;
  snapshot.payments[0].providerMandateId = mandateId;
  snapshot.mandates = [
    {
      providerId: mandateId,
      customerId: f.customerId,
      status: "active",
      observedAt: "2026-09-02T00:00:00.000Z",
    },
  ];
  snapshot.credits = [
    {
      currency: "GBP",
      providerId: `cn_${f.organisationId.replaceAll("-", "")}`,
      amountPence: "1000",
      status: "issued",
    },
  ];
  const provider: BillingReconciliationProvider = {
    scope: f.scope,
    async resolveEvent() {
      return { invoiceIds: [], mandate: null };
    },
    async fetchInvoice() {
      return structuredClone(snapshot);
    },
    async listInvoices() {
      return { invoiceIds: [], cursor: null };
    },
  };
  try {
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    snapshot.mandates[0].status = "pending";
    snapshot.mandates[0].observedAt = "2026-09-01T00:00:00.000Z";
    await reconcileBillingInvoice(f.worker, provider, snapshot.invoice.id);
    const [mandate] = await f.admin<
      { status: string }[]
    >`select status from operations.mandate_projections where organisation_id=${f.organisationId}`;
    assert.equal(mandate.status, "active");
    assert.equal(
      (
        await f.admin`select id from operations.invoice_credits where organisation_id=${f.organisationId}`
      ).length,
      1,
    );
    assert.equal(
      (
        await f.admin`select id from operations.billing_exceptions where organisation_id=${f.organisationId} and category='uncollectible_review'`
      ).length,
      1,
    );
  } finally {
    await f.cleanup();
  }
});
