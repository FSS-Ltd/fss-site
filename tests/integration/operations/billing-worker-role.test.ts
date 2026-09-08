import assert from "node:assert/strict";
import test from "node:test";
import { getBillingWorkerDb } from "../../../lib/operations/billing/worker-db";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

test("worker connection forces its least-privilege role even with an administrator test URL", async () => {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const previousEnabled = process.env.OPERATIONS_ENABLED;
  const previousUrl = process.env.OPERATIONS_BILLING_DATABASE_URL;
  try {
    process.env.OPERATIONS_ENABLED = "false";
    assert.throws(getBillingWorkerDb, /disabled/);
    process.env.OPERATIONS_ENABLED = "true";
    delete process.env.OPERATIONS_BILLING_DATABASE_URL;
    assert.throws(getBillingWorkerDb, /not configured/);
    process.env.OPERATIONS_BILLING_DATABASE_URL = url;
    const worker = getBillingWorkerDb();
    try {
      assert.equal(getBillingWorkerDb(), worker);
      const [identity] = await worker<
        { role: string; bypass: boolean }[]
      >`select current_user as role,rolbypassrls as bypass from pg_roles where rolname=current_user`;
      assert.deepEqual(identity, {
        role: "operations_billing_worker",
        bypass: false,
      });
      await assert.rejects(worker`select * from operations.organisations`, {
        code: "42501",
      });
      await assert.rejects(worker`select * from growth.prospects`, {
        code: "42501",
      });
      await assert.rejects(
        worker`delete from operations.billing_provider_events`,
        { code: "42501" },
      );
      const events =
        await worker`select id from operations.billing_provider_events limit 1`;
      assert.ok(events.length <= 1);
    } finally {
      await worker.end();
    }
  } finally {
    if (previousEnabled === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = previousEnabled;
    if (previousUrl === undefined)
      delete process.env.OPERATIONS_BILLING_DATABASE_URL;
    else process.env.OPERATIONS_BILLING_DATABASE_URL = previousUrl;
  }
});
