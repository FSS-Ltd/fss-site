import type { Currency } from "../../../lib/operations/money";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import type Stripe from "stripe";
import type { InvoiceReconciliation } from "../../../lib/operations/billing/reconciliation-types";
export function invoiceSnapshot(
  id: string,
  customerId: string,
): InvoiceReconciliation {
  // Minimal SDK fixture contains precisely the invoice fields read by reconciliation and recordInvoice.
  const invoice = {
    id,
    object: "invoice",
    livemode: false,
    customer: customerId,
    status: "paid",
    currency: "gbp",
    number: "TEST-1",
    total: 6000,
    subtotal: 6000,
    amount_due: 6000,
    amount_overpaid: 0,
    amount_paid: 6000,
    amount_remaining: 0,
    due_date: 1788220800,
    status_transitions: { finalized_at: 1788220800 },
    lines: { object: "list", data: [], has_more: false, url: "/test" },
  } as unknown as Stripe.Invoice;
  return {
    invoice,
    customerId,
    subscriptionId: null,
    subscriptionScheduleId: null,
    credits: [],
    mandates: [],
    payments: [
      {
        currency: "GBP",
        providerId: `pi_${id.slice(3)}`,
        customerId,
        state: "succeeded",
        method: "card",
        amountPence: "6000",
        receivedPence: "6000",
        confirmedAt: "2026-09-01T00:00:00.000Z",
        failureCode: null,
        providerMandateId: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        observedAt: "2026-09-01T00:00:00.000Z",
        allocationId: `inpay_${id.slice(3)}`,
        allocationPence: "6000",
        refunds: [],
        disputes: [],
      },
    ],
  };
}
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  createBillingFixture,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
export async function createReconciliationFixture(currency: Currency = "GBP") {
  const url = requireOperationsTestDatabaseUrl(
    process.env.OPERATIONS_TEST_DATABASE_URL,
  );
  const admin = postgres(url, { max: 2 });
  const founder = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_founder" },
  });
  const worker = postgres(url, {
    max: 5,
    connection: { options: "-c role=operations_billing_worker" },
  });
  const draft = agreementDraft();
  draft.currency = currency;
  draft.lines[0].taxPence = "0";
  draft.lines[0].unitPence = "12000";
  const fixture = await createBillingFixture(admin, founder, draft);
  const suffix = randomUUID().replaceAll("-", "");
  const invoiceIds = [`in_first${suffix}`, `in_second${suffix}`];
  const customerId = `cus_${suffix}`;
  const schedules = await createBillingSchedule(
    founder,
    billingFounder,
    fixture.scope,
    fixture.agreementId,
    fixture.revision,
    fixture.correlationId,
  );
  await withAgreementTransaction(founder, billingFounder, async (tx, actor) => {
    await tx`insert into operations.billing_customers(organisation_id,account_id,environment,currency,provider_customer_id,created_by,correlation_id) values(${fixture.organisationId},${fixture.scope.accountId},'test',${currency},${customerId},${actor.actorId},${fixture.correlationId})`;
    for (let index = 0; index < schedules.length; index++)
      await tx`update operations.billing_schedules set provider_reference=${invoiceIds[index]} where id=${schedules[index]}`;
  });
  return {
    ...fixture,
    admin,
    founder,
    worker,
    invoiceIds,
    customerId,
    async cleanup() {
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
          [fixture.organisationId],
        );
      await admin`delete from operations.billing_exceptions where object_id in ${admin(invoiceIds)}`;
      await admin`delete from operations.billing_provider_events where object_id in ${admin(invoiceIds)}`;
      await admin`delete from operations.billing_projection_leases where object_id in ${admin(invoiceIds)}`;
      await removeBillingFixture(admin, fixture);
      await worker.end();
      await founder.end();
      await admin.end();
    },
  };
}
