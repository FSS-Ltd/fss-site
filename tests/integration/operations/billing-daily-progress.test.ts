import assert from "node:assert/strict";
import test from "node:test";
import { reconcileDailyBilling } from "../../../lib/operations/billing/reconciliation";
import type { BillingReconciliationProvider } from "../../../lib/operations/billing/reconciliation-types";
import {
  createReconciliationFixture,
  invoiceSnapshot,
} from "./payment-reconciliation-fixtures";

for (const transientFailure of [false, true])
  test(`daily reconciliation checkpoints each invoice across ${transientFailure ? "transient failure" : "budget exhaustion"}`, async () => {
    const f = await createReconciliationFixture();
    let clock = 0;
    let lists = 0;
    let failOnce = transientFailure;
    const reads: string[] = [];
    const provider: BillingReconciliationProvider = {
      scope: f.scope,
      async resolveEvent() {
        return { invoiceIds: [], mandate: null };
      },
      async listInvoices(cursor) {
        assert.equal(cursor, null);
        lists++;
        return { invoiceIds: f.invoiceIds, cursor: null };
      },
      async fetchInvoice(id) {
        reads.push(id);
        clock += 10000;
        if (failOnce && id === f.invoiceIds[1]) {
          failOnce = false;
          throw new Error("Transient provider read failure");
        }
        return invoiceSnapshot(id, f.customerId);
      },
    };
    const options = {
      limit: 5,
      budgetMs: transientFailure ? 30000 : 10000,
      now: () => clock,
    };
    try {
      await f.admin`delete from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
      if (transientFailure)
        await assert.rejects(
          reconcileDailyBilling(f.worker, provider, f.scope, options),
          /Transient provider/,
        );
      else
        assert.deepEqual(
          await reconcileDailyBilling(f.worker, provider, f.scope, options),
          { processed: 1, pending: true, skipped: false },
        );
      const [progress] = await f.admin<
        { pending: string[]; lease: string | null }[]
      >`select pending_invoice_ids as pending,lease_token::text as lease from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
      assert.deepEqual(progress.pending, [f.invoiceIds[1]]);
      assert.equal(progress.lease, null);
      assert.deepEqual(
        await reconcileDailyBilling(f.worker, provider, f.scope, options),
        { processed: 1, pending: false, skipped: false },
      );
      assert.equal(lists, 1);
      assert.deepEqual(
        reads,
        transientFailure
          ? [f.invoiceIds[0], f.invoiceIds[1], f.invoiceIds[1]]
          : f.invoiceIds,
      );
      assert.equal(
        (await reconcileDailyBilling(f.worker, provider, f.scope, options))
          .skipped,
        true,
      );
      const [complete] = await f.admin<
        { throttled: boolean; pending: string[] }[]
      >`select next_run_at>now()+interval '23 hours' as throttled,pending_invoice_ids as pending from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
      assert.equal(complete.throttled, true);
      assert.deepEqual(complete.pending, []);
    } finally {
      await f.admin`delete from operations.billing_reconciliation_cursors where account_id=${f.scope.accountId} and environment='test'`;
      await f.cleanup();
    }
  });
