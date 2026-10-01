import { parseStripeCurrency, stripeCurrency } from "../money";
import { z } from "zod";
import type Stripe from "stripe";
import type { OperationsTransaction } from "../db/client";
import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingSchedule,
  BillingScope,
} from "./domain-types";
import { validateBillingScope } from "./scope";
import {
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
  type WorkspaceCollectionPage,
} from "../workspaces/pagination";

type InvoiceSelection = {
  invoiceId: string | null;
  limit: number;
  offset: number;
};

async function selectInvoices(
  tx: OperationsTransaction,
  scope: BillingScope,
  selection: InvoiceSelection,
): Promise<BillingInvoice[]> {
  validateBillingScope(scope);
  const { invoiceId, limit, offset } = selection;
  return [
    ...(await tx<
      BillingInvoice[]
    >`select id,provider_invoice_id as "providerInvoiceId",number,status,currency,total_pence::text as "totalPence",amount_due_pence::text as "amountDuePence",amount_overpaid_pence::text as "amountOverpaidPence",amount_paid_pence::text as "amountPaidPence",amount_remaining_pence::text as "amountRemainingPence",due_date::text as "dueDate",projected_at::text as "projectedAt",
      (select p.state from operations.payment_allocations a join operations.payments p on p.id=a.payment_id
       where a.invoice_id=invoices.id and p.organisation_id=invoices.organisation_id
       order by (p.state='processing') desc,p.provider_created_at desc,p.id limit 1) as "paymentState",
      (select m.status from operations.payment_allocations a join operations.payments p on p.id=a.payment_id
       join operations.mandate_projections m on m.provider_mandate_id=p.provider_mandate_id and m.account_id=p.account_id and m.environment=p.environment and m.organisation_id=p.organisation_id
       where a.invoice_id=invoices.id and p.organisation_id=invoices.organisation_id
       order by (p.state='processing') desc,p.provider_created_at desc,p.id limit 1) as "mandateState"
      from operations.invoices where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and (${invoiceId}::uuid is null or id=${invoiceId}::uuid) order by created_at desc,id limit ${limit} offset ${offset}`),
  ];
}
export async function loadInvoices(
  tx: OperationsTransaction,
  scope: BillingScope,
): Promise<BillingInvoice[]> {
  return selectInvoices(tx, scope, {
    invoiceId: null,
    limit: 100,
    offset: 0,
  });
}

export async function loadInvoicePage(
  tx: OperationsTransaction,
  scope: BillingScope,
  page: number,
): Promise<WorkspaceCollectionPage<BillingInvoice>> {
  const rows = await selectInvoices(tx, scope, {
    invoiceId: null,
    limit: workspacePageSize + 1,
    offset: workspacePageOffset(page),
  });
  return toWorkspaceCollectionPage(rows, page);
}
export async function loadBillingSchedule(
  tx: OperationsTransaction,
  scope: BillingScope,
  id: string,
): Promise<BillingSchedule> {
  validateBillingScope(scope);
  const [row] = await tx<
    BillingSchedule[]
  >`select id,organisation_id as "organisationId",account_id as "accountId",environment as mode,agreement_id as "agreementId",revision,obligation_key as key,currency,owner,amount_pence::text as "amountPence",due_date::text as "dueDate",end_date::text as "endDate",recurrence_months as "recurrenceMonths",description,provider_reference as "providerReference" from operations.billing_schedules where organisation_id=${scope.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and id=${id}`;
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
  if (invoice.currency !== stripeCurrency(schedule.currency))
    throw new Error(
      "Provider invoice currency differs from signed obligation.",
    );
  const snapshot = issuedInvoiceSnapshot(invoice);
  const dueDate = snapshot.dueDate;
  await tx`insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_due_pence,amount_overpaid_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id) values(${schedule.organisationId},${schedule.id},${schedule.accountId},${schedule.mode},${invoice.id},${invoice.number},${invoice.status},${schedule.currency},${String(invoice.total)},${String(invoice.amount_due)},${String(invoice.amount_overpaid)},${String(invoice.amount_paid)},${String(invoice.amount_remaining)},${dueDate},${tx.json(snapshot)},now(),${actorId},${correlationId}) on conflict(account_id,environment,provider_invoice_id) do nothing`;
}

export async function loadInvoice(
  tx: OperationsTransaction,
  scope: BillingScope,
  id: string,
): Promise<BillingInvoice | null> {
  z.uuid().parse(id);
  return (
    (
      await selectInvoices(tx, scope, {
        invoiceId: id,
        limit: 1,
        offset: 0,
      })
    )[0] ?? null
  );
}

const issuedSnapshotSchema = z.object({
  issuedAt: z.number().int().nonnegative().nullable(),
  lines: z
    .array(
      z.object({
        amountPence: z.string().regex(/^\d+$/),
        description: z.string().max(2000).nullable(),
      }),
    )
    .max(200),
});

export async function loadInvoiceDetail(
  tx: OperationsTransaction,
  scope: BillingScope,
  id: string,
): Promise<BillingInvoiceDetail | null> {
  const invoice = await loadInvoice(tx, scope, id);
  if (!invoice) return null;

  const [row] = await tx<{ issuedSnapshot: unknown }[]>`
    select issued_snapshot as "issuedSnapshot"
    from operations.invoices
    where organisation_id = ${scope.organisationId}
      and account_id = ${scope.accountId}
      and environment = ${scope.mode}
      and id = ${id}
  `;
  const snapshot = issuedSnapshotSchema.safeParse(row?.issuedSnapshot);
  if (!snapshot.success)
    throw new Error("Issued invoice snapshot is unavailable.");

  return {
    ...invoice,
    issuedAt: snapshot.data.issuedAt
      ? new Date(snapshot.data.issuedAt * 1000).toISOString()
      : null,
    lines: snapshot.data.lines,
  };
}

export function issuedInvoiceSnapshot(invoice: Stripe.Invoice) {
  if (invoice.lines.has_more)
    throw new Error("Complete invoice lines are required before recording.");
  if (!invoice.status || invoice.status === "draft")
    throw new Error("Only issued invoices can be recorded.");
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10)
    : null;
  // Retain a deliberately shaped financial snapshot, without hosted bearer URLs or payment details.
  return {
    providerInvoiceId: invoice.id,
    number: invoice.number,
    currency: parseStripeCurrency(invoice.currency),
    totalPence: String(invoice.total),
    subtotalPence: String(invoice.subtotal),
    amountDuePence: String(invoice.amount_due),
    dueDate,
    issuedAt: invoice.status_transitions.finalized_at,
    lines: invoice.lines.data.map((line) => ({
      description: line.description,
      amountPence: String(line.amount),
      period: { start: line.period.start, end: line.period.end },
    })),
  };
}
