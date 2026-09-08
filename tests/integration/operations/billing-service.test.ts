import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeBillingObligation } from "../../../lib/operations/billing/invoice-service";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import {
  loadInvoices,
  loadInvoice,
} from "../../../lib/operations/billing/invoice-repository";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import {
  createBillingTestDatabases,
  createBillingFixture,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { billingProviderFixture } from "./billing-provider-fixture";
test("production billing command persists a single customer and issued invoice across renamed retries", async () => {
  const { admin, db } = createBillingTestDatabases();
  const f = await createBillingFixture(admin, db);
  const p = billingProviderFixture();
  try {
    const [id] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      f.agreementId,
      2,
      f.correlationId,
    );
    const issue = (key: string) =>
      executeBillingObligation(
        db,
        billingFounder,
        f.scope,
        id,
        key,
        p.stripe,
        f.correlationId,
      );
    const first = await issue("first");
    const same = await issue("first");
    const renamed = await issue("new-browser-key");
    assert.equal(first.providerId, same.providerId);
    assert.equal(first.providerId, renamed.providerId);
    for (const path of [
      "/v1/customers",
      "/v1/invoices",
      "/v1/invoiceitems",
      "/v1/invoices/in_synthetic/finalize",
    ])
      assert.equal(
        p.requests.filter((r) => r.path === path && r.method === "POST").length,
        1,
      );
    const invoices = await withAgreementTransaction(db, billingFounder, (tx) =>
      loadInvoices(tx, f.scope),
    );
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].totalPence, "6000");
    assert.equal(invoices[0].dueDate, "2026-10-01");
    assert.deepEqual(
      await withAgreementTransaction(db, billingFounder, (tx) =>
        loadInvoice(tx, f.scope, invoices[0].id),
      ),
      invoices[0],
    );
    assert.equal(
      await withAgreementTransaction(db, billingFounder, (tx) =>
        loadInvoice(tx, f.scope, randomUUID()),
      ),
      null,
    );
    const [saved] = await admin<
      { snapshot: { totalPence: string; lines: unknown[] } }[]
    >`select issued_snapshot as snapshot from operations.invoices where organisation_id=${f.organisationId}`;
    assert.equal(saved.snapshot.totalPence, "6000");
    assert.equal(saved.snapshot.lines.length, 1);
    assert.equal(
      JSON.stringify(saved.snapshot).includes("hosted_invoice_url"),
      false,
    );
    await assert.rejects(
      executeBillingObligation(
        db,
        null,
        f.scope,
        id,
        "no-auth",
        p.stripe,
        f.correlationId,
      ),
      /Founder authorization/,
    );
    p.state.accountId = "acct_wrong";
    await assert.rejects(issue("first"), /account mismatch/);
  } finally {
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
test("signed tax fails before any provider request or customer mapping", async () => {
  const { admin, db } = createBillingTestDatabases();
  const f = await createBillingFixture(admin, db, agreementDraft());
  const p = billingProviderFixture();
  try {
    const [id] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      f.agreementId,
      2,
      f.correlationId,
    );
    await assert.rejects(
      executeBillingObligation(
        db,
        billingFounder,
        f.scope,
        id,
        "tax",
        p.stripe,
        f.correlationId,
      ),
      /tax mapping/,
    );
    assert.equal(p.requests.length, 0);
    assert.equal(
      (
        await admin`select id from operations.billing_customers where organisation_id=${f.organisationId}`
      ).length,
      0,
    );
  } finally {
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
