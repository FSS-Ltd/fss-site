import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createBillingFixture,
  createBillingTestDatabases,
  billingFounder,
  removeBillingFixture,
} from "./billing-fixtures";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { loadMetricsSnapshot } from "../../../lib/operations/metrics/snapshot-repository";
test("SQL cards reconcile signed contracts, partial credits and on-time settlement with later excess cash", async () => {
  const { admin, db } = createBillingTestDatabases(),
    draft = agreementDraft();
  draft.requiredDepositPence = "0";
  draft.assetsRequired = false;
  draft.installments = [];
  draft.lines = [
    {
      ...draft.lines[0],
      unitPence: "30000",
      taxPence: "0",
      recurrenceMonths: 1,
      startDate: "2026-09-06",
    },
    {
      ...draft.lines[0],
      serviceCode: "annual",
      unitPence: "120000",
      taxPence: "0",
      recurrenceMonths: 12,
      startDate: "2026-09-06",
    },
    {
      ...draft.lines[0],
      serviceCode: "future",
      unitPence: "50000",
      taxPence: "0",
      recurrenceMonths: 1,
      startDate: "2026-10-01",
    },
  ];
  const f = await createBillingFixture(admin, db, draft);
  try {
    for (let line = 1; line <= 2; line++)
      await executeAgreementCommand(
        db,
        billingFounder,
        f.organisationId,
        {
          action: "activate",
          agreementId: f.agreementId,
          expectedVersion: line + 2,
          lineNumber: line,
          evidence: {
            effectiveDate: "2026-09-06",
            assetsReady: true,
            deposit: null,
          },
        },
        f.correlationId,
      );
    const schedules = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      f.agreementId,
      2,
      f.correlationId,
    );
    const ids = [randomUUID(), randomUUID()];
    for (let index = 0; index < 2; index++)
      await admin`insert into operations.invoices(id,organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_due_pence,amount_overpaid_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id) values(${ids[index]},${f.organisationId},${schedules[0]},'acct_billingTest','test',${"in_" + randomUUID()},${"TEST-" + index},${index === 0 ? "open" : "paid"},'GBP',${index === 0 ? "100000" : "10000"},${index === 0 ? "100000" : "10000"},${index === 0 ? "0" : "1000"},${index === 0 ? "30000" : "10000"},${index === 0 ? "60000" : "0"},'2026-09-07','{}',now(),${billingFounder.actorId},${f.correlationId})`;
    const payments = [
      {
        invoice: ids[0],
        received: "30000",
        applied: "30000",
        confirmed: "2026-09-07T12:00:00Z",
      },
      {
        invoice: ids[1],
        received: "10000",
        applied: "10000",
        confirmed: "2026-09-07T12:00:00Z",
      },
      {
        invoice: ids[1],
        received: "1000",
        applied: "0",
        confirmed: "2026-09-08T09:00:00Z",
      },
    ];
    for (const p of payments) {
      const payment = randomUUID();
      await admin`insert into operations.payments(id,organisation_id,account_id,environment,provider_payment_id,state,method,amount_pence,received_pence,confirmed_at,provider_created_at) values(${payment},${f.organisationId},'acct_billingTest','test',${"pi_" + randomUUID()},'succeeded','card',${p.received},${p.received},${p.confirmed},${p.confirmed})`;
      await admin`insert into operations.payment_allocations(organisation_id,invoice_id,payment_id,provider_allocation_id,amount_pence,provider_paid_pence) values(${f.organisationId},${p.invoice},${payment},${randomUUID()},${p.applied},${p.received})`;
    }
    await admin`insert into operations.invoice_credits(organisation_id,account_id,environment,invoice_id,provider_credit_id,amount_pence,status) values(${f.organisationId},'acct_billingTest','test',${ids[0]},${randomUUID()},10000,'issued')`;
    const snapshot = await loadMetricsSnapshot(
      db,
      billingFounder,
      { organisationId: f.organisationId },
      { observedAt: "2026-09-08T12:00:00.000Z", providerScope: f.scope },
    );
    assert.equal(snapshot.revenue.active, "480000");
    assert.equal(snapshot.revenue.awaiting, "600000");
    assert.equal(
      snapshot.revenue.rows.reduce((n, r) => n + BigInt(r.end), BigInt(0)),
      BigInt(snapshot.revenue.active),
    );
    const r = snapshot.receivables;
    assert.ok(r);
    assert.equal(r.outstanding, "60000");
    assert.equal(r.overdue, "60000");
    assert.equal(r.onTime, "1");
    assert.equal(r.eligible, "2");
    assert.equal(r.rows.find((x) => x.id === ids[1])?.daysLate, 0);
    assert.equal(
      r.rows.reduce((n, x) => n + BigInt(x.remaining), BigInt(0)),
      BigInt(r.outstanding),
    );
  } finally {
    for (const table of [
      "payment_allocations",
      "invoice_credits",
      "payments",
      "service_instances",
    ])
      await admin.unsafe(
        `delete from operations.${table} where organisation_id=$1`,
        [f.organisationId],
      );
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
