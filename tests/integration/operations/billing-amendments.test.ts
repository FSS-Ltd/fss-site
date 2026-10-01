import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeBillingObligation } from "../../../lib/operations/billing/invoice-service";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { previewBillingAmendment } from "../../../lib/operations/billing/amendments";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import {
  createBillingTestDatabases,
  createBillingFixture,
  createSignedBillingAmendment,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { billingProviderFixture } from "./billing-provider-fixture";
test("production amendment persists founder hold and preview while preserving current provider subscription", async () => {
  const { admin, db } = createBillingTestDatabases();
  const draft = agreementDraft();
  draft.lines[0].taxPence = "0";
  draft.lines[0].unitPence = "12000";
  draft.lines[0].recurrenceMonths = 12;
  draft.lines[0].startDate = new Date().toISOString().slice(0, 10);
  draft.installments = [];
  const f = await createBillingFixture(admin, db, draft);
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
    await executeBillingObligation(
      db,
      billingFounder,
      f.scope,
      id,
      "annual",
      p.stripe,
      f.correlationId,
    );
    p.state.latestInvoiceId = "in_renewal";
    const retry = await executeBillingObligation(
      db,
      billingFounder,
      f.scope,
      id,
      "annual",
      p.stripe,
      f.correlationId,
    );
    assert.equal(retry.invoice?.id, "in_synthetic");
    assert.equal(
      p.requests.some((r) => r.path.includes("in_renewal")),
      false,
    );
    assert.equal(
      p.requests.filter((r) => r.path.endsWith("/finalize")).length,
      1,
    );
    const proposed = await createSignedBillingAmendment(db, f, draft);
    const input = {
      scheduleId: id,
      agreementId: proposed.agreementId,
      revision: proposed.revision,
      lineNumber: 1,
      effectiveAt: "2026-09-08T05:41:48.695Z",
    };
    const preview = await previewBillingAmendment(
      db,
      billingFounder,
      f.scope,
      input,
      p.stripe,
      f.correlationId,
    );
    await assert.rejects(
      createBillingSchedule(
        db,
        billingFounder,
        f.scope,
        proposed.agreementId,
        proposed.revision,
        f.correlationId,
      ),
      /held for founder approval/,
    );
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        { ...input, agreementId: f.agreementId, revision: f.revision },
        p.stripe,
        f.correlationId,
      ),
      /already has a collection claim/,
    );
    assert.equal(preview.state, "awaiting_founder_approval");
    assert.equal(preview.totalPence, "7999");
    const [held] = await admin<
      { state: string; preview: { totalPence: string } }[]
    >`select state,preview from operations.billing_amendment_previews where id=${preview.id}`;
    assert.equal(held.state, "awaiting_founder_approval");
    assert.equal(held.preview.totalPence, "7999");
    assert.equal(p.state.pricePence, 12000);
    assert.equal(
      p.requests.filter(
        (r) =>
          r.method === "POST" && r.path === "/v1/subscriptions/sub_synthetic",
      ).length,
      0,
    );
    const request = p.requests.find(
      (r) => r.path === "/v1/invoices/create_preview",
    );
    assert.equal(
      request?.params.get("subscription_details[proration_date]"),
      "1788846108",
    );
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        { ...input, lineNumber: 30 },
        p.stripe,
        f.correlationId,
      ),
      /line required/,
    );
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        { ...f.scope, organisationId: randomUUID() },
        input,
        p.stripe,
        f.correlationId,
      ),
      /not found/,
    );
    p.state.subscriptionCustomer = "cus_other";
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        input,
        p.stripe,
        f.correlationId,
      ),
      /context mismatch/,
    );
    p.state.subscriptionCustomer = p.state.customerId;
    p.state.previewCurrency = "usd";
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        input,
        p.stripe,
        f.correlationId,
      ),
      /same-currency/,
    );
    assert.equal(
      (
        await admin`select id from operations.billing_amendment_previews where organisation_id=${f.organisationId}`
      ).length,
      1,
    );
  } finally {
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
