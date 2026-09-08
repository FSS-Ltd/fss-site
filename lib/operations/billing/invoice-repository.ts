import { z } from "zod";
import type Stripe from "stripe";
import type { OperationsTransaction } from "../db/client";
import type {
  BillingInvoice,
  BillingSchedule,
  BillingScope,
} from "./domain-types";
import { validateBillingScope } from "./scope";
export async function loadInvoices(
  tx: OperationsTransaction,
  scope: BillingScope,
): Promise<BillingInvoice[]> {
  validateBillingScope(scope);
  return [
    ...(await tx<
      BillingInvoice[]
    >`select id,provider_invoice_id as "providerInvoiceId",number,status,currency,total_pence::text as "totalPence",amount_paid_pence::text as "amountPaidPence",amount_remaining_pence::text as "amountRemainingPence",due_date::text as "dueDate",projected_at::text as "projectedAt" from operations.invoices where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} order by created_at desc,id limit 100`),
  ];
}
export async function loadBillingSchedule(
  tx: OperationsTransaction,
  scope: BillingScope,
  id: string,
): Promise<BillingSchedule> {
  validateBillingScope(scope);
  const [row] = await tx<
    BillingSchedule[]
  >`select id,organisation_id as "organisationId",account_id as "accountId",environment as mode,agreement_id as "agreementId",revision,obligation_key as key,owner,amount_pence::text as "amountPence",due_date::text as "dueDate",end_date::text as "endDate",recurrence_months as "recurrenceMonths",description,provider_reference as "providerReference" from operations.billing_schedules where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and id=${id}`;
  if (!row) throw new Error("Billing schedule not found.");
  return row;
}
export async function recordInvoice(
  tx: OperationsTransaction,
  schedule: BillingSchedule,
  invoice: Stripe.Invoice,
  actorId: string,
  correlationId: string,
): Promise<void> {
  if (invoice.lines.has_more)
    throw new Error("Complete invoice lines are required before recording.");
  if (
    !invoice.status ||
    invoice.status === "draft" ||
    invoice.currency !== "gbp"
  )
    throw new Error("Only issued GBP invoices can be recorded.");
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10)
    : null;
  // Retain a deliberately shaped financial snapshot, without hosted bearer URLs or payment details.
  const snapshot = {
    providerInvoiceId: invoice.id,
    number: invoice.number,
    currency: "GBP",
    totalPence: String(invoice.total),
    subtotalPence: String(invoice.subtotal),
    dueDate,
    issuedAt: invoice.status_transitions.finalized_at,
    lines: invoice.lines.data.map((line) => ({
      description: line.description,
      amountPence: String(line.amount),
      period: { start: line.period.start, end: line.period.end },
    })),
  };
  await tx`insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id) values(${schedule.organisationId},${schedule.id},${schedule.accountId},${schedule.mode},${invoice.id},${invoice.number},${invoice.status},'GBP',${String(invoice.total)},${String(invoice.amount_paid)},${String(invoice.amount_remaining)},${dueDate},${tx.json(snapshot)},now(),${actorId},${correlationId}) on conflict(account_id,environment,provider_invoice_id) do nothing`;
}

export async function loadInvoice(
  tx: OperationsTransaction,
  scope: BillingScope,
  id: string,
): Promise<BillingInvoice | null> {
  validateBillingScope(scope);
  z.uuid().parse(id);
  const [row] = await tx<
    BillingInvoice[]
  >`select id,provider_invoice_id as "providerInvoiceId",number,status,currency,total_pence::text as "totalPence",amount_paid_pence::text as "amountPaidPence",amount_remaining_pence::text as "amountRemainingPence",due_date::text as "dueDate",projected_at::text as "projectedAt" from operations.invoices where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and id=${id}`;
  return row ?? null;
}
