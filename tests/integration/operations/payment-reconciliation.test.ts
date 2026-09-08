import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  createBillingFixture,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import { recordBillingEvent } from "../../../lib/operations/billing/events";
import {
  reconcileBillingInvoice,
  reconcileDailyBilling,
  runBillingEventWorker,
} from "../../../lib/operations/billing/reconciliation";
import { listBillingExceptions } from "../../../lib/operations/billing/exception-repository";
import { refreshCollectionsReview } from "../../../lib/operations/billing/collections";
import {
  BillingReconciliationError,
  type BillingReconciliationProvider,
} from "../../../lib/operations/billing/reconciliation-types";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
import { invoiceSnapshot } from "./payment-reconciliation-fixtures";
test("durable replay, authoritative ordering, refund/dispute, immutable paid evidence and role boundaries", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_founder" },
  });
  const worker = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_billing_worker" },
  });
  const f = await createBillingFixture(admin, founder);
  const suffix = randomUUID().replaceAll("-", "");
  const invoiceId = `in_${suffix}`;
  const customerId = `cus_${suffix}`;
  let snapshot = invoiceSnapshot(invoiceId, customerId);
  let calls = 0;
  const provider: BillingReconciliationProvider = {
    scope: f.scope,
    async resolveEvent() {
      return { invoiceIds: [invoiceId], mandate: null };
    },
    async fetchInvoice() {
      calls++;
      return structuredClone(snapshot);
    },
    async listInvoices() {
      return { invoiceIds: [invoiceId], cursor: null };
    },
  };
  try {
    const schedules = await createBillingSchedule(
      founder,
      billingFounder,
      f.scope,
      f.agreementId,
      f.revision,
      f.correlationId,
    );
    await withAgreementTransaction(
      founder,
      billingFounder,
      async (tx, actor) => {
        await tx`insert into operations.billing_customers(organisation_id,account_id,environment,provider_customer_id,created_by,correlation_id) values(${f.organisationId},${f.scope.accountId},'test',${customerId},${actor.actorId},${f.correlationId})`;
        await tx`update operations.billing_schedules set provider_reference=${invoiceId} where id=${schedules[0]}`;
      },
    );
    const receipt = {
      accountId: f.scope.accountId,
      mode: "test" as const,
      eventId: `evt_${suffix}`,
      eventType: "invoice.paid",
      objectId: invoiceId,
      payloadHash: "a".repeat(64),
      occurredAt: "2026-09-01T00:00:00.000Z",
    };
    assert.equal(await recordBillingEvent(worker, receipt), "recorded");
    assert.equal(await recordBillingEvent(worker, receipt), "duplicate");
    assert.deepEqual(await runBillingEventWorker(worker, provider, f.scope), {
      processed: 1,
      exceptions: 0,
      deferred: 0,
    });
    await recordBillingEvent(worker, {
      ...receipt,
      eventId: `evt_old${suffix}`,
      eventType: "invoice.payment_failed",
    });
    assert.equal(
      (await runBillingEventWorker(worker, provider, f.scope)).processed,
      1,
    );
    assert.equal(calls, 2);
    const [invoice] = await admin<
      { id: string; status: string }[]
    >`select id,status from operations.invoices where provider_invoice_id=${invoiceId}`;
    assert.equal(invoice.status, "paid");
    assert.equal(
      (
        await admin`select id from operations.payments where organisation_id=${f.organisationId}`
      ).length,
      1,
    );
    snapshot.payments[0].refunds = [
      { providerId: `re_${suffix}`, amountPence: "1000", status: "succeeded" },
    ];
    snapshot.payments[0].disputes = [
      {
        providerId: `dp_${suffix}`,
        amountPence: "2000",
        status: "needs_response",
      },
    ];
    await reconcileBillingInvoice(worker, provider, invoiceId);
    await reconcileBillingInvoice(worker, provider, invoiceId);
    assert.equal(
      (
        await admin`select id from operations.payment_refunds where organisation_id=${f.organisationId}`
      ).length,
      1,
    );
    const [payment] = await admin<
      { id: string; received: string }[]
    >`select id,received_pence::text as received from operations.payments where organisation_id=${f.organisationId}`;
    assert.equal(payment.received, "6000");
    await assert.rejects(
      worker`update operations.payments set state='failed',confirmed_at=null where id=${payment.id}`,
      /Paid evidence/,
    );
    await assert.rejects(
      worker`update operations.payment_allocations set amount_pence=7000 where payment_id=${payment.id}`,
      /immutable|over-allocation/,
    );
    await assert.rejects(worker`delete from operations.payments`, {
      code: "42501",
    });
    await assert.rejects(worker`select * from operations.organisations`, {
      code: "42501",
    });
    await assert.rejects(
      worker`update operations.billing_schedules set provider_reference='in_forbidden'`,
      { code: "42501" },
    );
    await assert.rejects(
      runBillingEventWorker(worker, provider, { ...f.scope, mode: "live" }),
      /scope_mismatch/,
    );
    // A payment committed before event acknowledgement fails is replayed without another payment/allocation.
    await recordBillingEvent(worker, {
      ...receipt,
      eventId: `evt_timeout${suffix}`,
    });
    let timeoutOnce = true;
    const timeoutProvider = {
      ...provider,
      async fetchInvoice() {
        if (timeoutOnce) {
          timeoutOnce = false;
          await admin`update operations.billing_provider_events set lease_until=now()-interval '1 second' where provider_event_id=${`evt_timeout${suffix}`}`;
        }
        return structuredClone(snapshot);
      },
    };
    assert.equal(
      (await runBillingEventWorker(worker, timeoutProvider, f.scope)).deferred,
      1,
    );
    await admin`update operations.billing_provider_events set next_attempt_at=now() where provider_event_id=${`evt_timeout${suffix}`}`;
    assert.equal(
      (await runBillingEventWorker(worker, timeoutProvider, f.scope)).processed,
      1,
    );
    assert.equal(
      (
        await admin`select id from operations.payment_allocations where invoice_id=${invoice.id}`
      ).length,
      1,
    );
    // A review queued before the authoritative paid reconciliation is suppressed atomically.
    await admin`insert into operations.billing_exceptions(organisation_id,account_id,environment,object_id,category,operation_key) values(${f.organisationId},${f.scope.accountId},'test',${invoiceId},'overdue_review',${`race:${suffix}`})`;
    await reconcileBillingInvoice(worker, provider, invoiceId);
    await worker.begin((tx) => refreshCollectionsReview(tx, invoice.id));
    assert.equal(
      (
        await admin`select id from operations.billing_exceptions where operation_key=${`race:${suffix}`} and resolved_at is null`
      ).length,
      0,
    );
    // Empty draft-only pages advance; subsequent calls resume immediately, then throttle completed sweeps.
    await admin`delete from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
    const cursors: (string | null)[] = [];
    const paged = {
      ...provider,
      async listInvoices(cursor: string | null) {
        cursors.push(cursor);
        return cursor === null
          ? { invoiceIds: [], cursor: "in_draftPage" }
          : { invoiceIds: [invoiceId], cursor: null };
      },
    };
    assert.deepEqual(await reconcileDailyBilling(worker, paged, f.scope), {
      processed: 0,
      pending: true,
      skipped: false,
    });
    assert.deepEqual(await reconcileDailyBilling(worker, paged, f.scope), {
      processed: 1,
      pending: false,
      skipped: false,
    });
    assert.equal(
      (await reconcileDailyBilling(worker, paged, f.scope)).skipped,
      true,
    );
    assert.deepEqual(cursors, [null, "in_draftPage"]);
    snapshot = { ...snapshot, customerId: `cus_unmapped${suffix}` };
    await recordBillingEvent(worker, {
      ...receipt,
      eventId: `evt_wrong${suffix}`,
    });
    assert.equal(
      (await runBillingEventWorker(worker, provider, f.scope)).exceptions,
      1,
    );
    assert.equal(
      (
        await admin`select id from operations.billing_exceptions where object_id=${invoiceId} and category='unknown_mapping'`
      ).length,
      1,
    );
    const queue = await listBillingExceptions(founder, billingFounder);
    assert.ok(
      queue.rows.some(
        (exception) =>
          exception.objectId === invoiceId && exception.organisationId === null,
      ),
    );
    await assert.rejects(
      listBillingExceptions(founder, null),
      /Founder authorization/,
    );
    await assert.rejects(
      listBillingExceptions(founder, billingFounder, "invalid"),
    );
    const portal = postgres(url, {
      max: 1,
      connection: { options: "-c role=operations_portal" },
    });
    try {
      await assert.rejects(
        portal`select * from operations.billing_exceptions`,
        { code: "42501" },
      );
    } finally {
      await portal.end();
    }
    const unknown: BillingReconciliationProvider = {
      ...provider,
      async resolveEvent() {
        throw new BillingReconciliationError("scope_mismatch");
      },
    };
    await recordBillingEvent(worker, {
      ...receipt,
      eventId: `evt_mode${suffix}`,
    });
    assert.equal(
      (await runBillingEventWorker(worker, unknown, f.scope)).exceptions,
      1,
    );
  } finally {
    for (const table of [
      "billing_exceptions",
      "billing_collection_holds",
      "payment_allocations",
      "payment_refunds",
      "payment_disputes",
      "invoice_credits",
      "mandate_projections",
      "payments",
    ])
      await admin.unsafe(
        `delete from operations.${table} where organisation_id=$1`,
        [f.organisationId],
      );
    await admin`delete from operations.billing_exceptions where object_id=${invoiceId}`;
    await admin`delete from operations.billing_provider_events where object_id=${invoiceId}`;
    await admin`delete from operations.billing_projection_leases where object_id=${invoiceId}`;
    await admin`delete from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
    await removeBillingFixture(admin, f);
    await worker.end();
    await founder.end();
    await admin.end();
  }
});
