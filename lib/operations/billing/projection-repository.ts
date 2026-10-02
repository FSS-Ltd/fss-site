import type { Currency } from "../money";
import { providerCurrency } from "./stripe-projections";
import { randomUUID } from "node:crypto";
import type { OperationsTransaction } from "../db/client";
import type { BillingCustomer, BillingSchedule } from "./domain-types";
import { applyPaymentProjection } from "./payment-repository";
import { recordInvoice } from "./invoice-repository";
import { refreshCollectionsReview } from "./collections";
import {
  BillingReconciliationError,
  type InvoiceReconciliation,
  type MandateProjection,
  type ProviderScope,
} from "./reconciliation-types";
export async function mappedCustomer(
  tx: OperationsTransaction,
  scope: ProviderScope,
  customerId: string,
): Promise<BillingCustomer> {
  const [customer] = await tx<
    BillingCustomer[]
  >`select id,organisation_id as "organisationId",account_id as "accountId",environment as mode,currency,provider_customer_id as "providerCustomerId" from operations.billing_customers where account_id=${scope.accountId} and environment=${scope.mode} and provider_customer_id=${customerId}`;
  if (!customer) throw new BillingReconciliationError("unknown_mapping");
  return customer;
}
export async function applyMandate(
  tx: OperationsTransaction,
  scope: ProviderScope,
  mandate: MandateProjection,
): Promise<void> {
  const customer = await mappedCustomer(tx, scope, mandate.customerId);
  const [existing] = await tx<
    { organisationId: string; customerId: string }[]
  >`select organisation_id as "organisationId",customer_id as "customerId" from operations.mandate_projections where account_id=${scope.accountId} and environment=${scope.mode} and provider_mandate_id=${mandate.providerId}`;
  if (
    existing &&
    (existing.organisationId !== customer.organisationId ||
      existing.customerId !== customer.id)
  )
    throw new BillingReconciliationError("scope_mismatch");
  await tx`insert into operations.mandate_projections(organisation_id,customer_id,account_id,environment,provider_mandate_id,status,projected_at) values(${customer.organisationId},${customer.id},${scope.accountId},${scope.mode},${mandate.providerId},${mandate.status},${mandate.observedAt}) on conflict(account_id,environment,provider_mandate_id) do update set status=excluded.status,projected_at=excluded.projected_at where mandate_projections.projected_at<=excluded.projected_at`;
}
export async function applyInvoiceProjection(
  tx: OperationsTransaction,
  scope: ProviderScope,
  snapshot: InvoiceReconciliation,
): Promise<string> {
  const { invoice } = snapshot;
  if (invoice.livemode !== (scope.mode === "live"))
    throw new BillingReconciliationError("scope_mismatch");
  if (invoice.status === "draft")
    throw new BillingReconciliationError("invalid_projection");
  const currency = providerCurrency(invoice.currency);
  const customer = await mappedCustomer(tx, scope, snapshot.customerId);
  if (customer.currency !== currency)
    throw new BillingReconciliationError("scope_mismatch");
  const [existing] = await tx<
    {
      id: string;
      organisationId: string;
      scheduleId: string;
      currency: Currency;
    }[]
  >`select id,organisation_id as "organisationId",schedule_id as "scheduleId",currency from operations.invoices where account_id=${scope.accountId} and environment=${scope.mode} and provider_invoice_id=${invoice.id} for update`;
  if (
    existing &&
    (existing.organisationId !== customer.organisationId ||
      existing.currency !== currency)
  )
    throw new BillingReconciliationError("scope_mismatch");
  if (!existing) {
    const schedules = await tx<
      BillingSchedule[]
    >`select id,organisation_id as "organisationId",account_id as "accountId",environment as mode,agreement_id as "agreementId",revision,obligation_key as key,currency,owner,amount_pence::text as "amountPence",due_date::text as "dueDate",end_date::text as "endDate",recurrence_months as "recurrenceMonths",description,provider_reference as "providerReference" from operations.billing_schedules where organisation_id=${customer.organisationId} and account_id=${scope.accountId} and environment=${scope.mode} and (provider_reference=${invoice.id} or (owner='subscription' and (provider_reference=${snapshot.subscriptionId} or provider_reference=${snapshot.subscriptionScheduleId})))`;
    if (schedules.length !== 1)
      throw new BillingReconciliationError("unknown_mapping");
    if (schedules[0].currency !== currency)
      throw new BillingReconciliationError("scope_mismatch");
    await recordInvoice(
      tx,
      schedules[0],
      invoice,
      "system:operations-billing",
      randomUUID(),
    );
  }
  const [row] = await tx<
    { id: string }[]
  >`update operations.invoices set status=${invoice.status},amount_paid_pence=${String(invoice.amount_paid)},amount_remaining_pence=${String(invoice.amount_remaining)},amount_due_pence=${String(invoice.amount_due)},amount_overpaid_pence=${String(invoice.amount_overpaid)},projected_at=now() where account_id=${scope.accountId} and environment=${scope.mode} and provider_invoice_id=${invoice.id} and organisation_id=${customer.organisationId} returning id`;
  // Stable ordering for a first observation; existing applied evidence always wins on replay.
  for (const payment of [...snapshot.payments].sort((left, right) =>
    left.providerId.localeCompare(right.providerId),
  )) {
    if (
      payment.customerId !== customer.providerCustomerId ||
      payment.currency !== currency
    )
      throw new BillingReconciliationError("scope_mismatch");
    await applyPaymentProjection(
      tx,
      scope,
      customer.organisationId,
      row.id,
      payment,
    );
  }
  const [adjustments] = await tx<
    { refund: boolean; dispute: boolean }[]
  >`select exists(select 1 from operations.payment_allocations a join operations.payment_refunds r on r.payment_id=a.payment_id where a.invoice_id=${row.id} and r.status='succeeded') as refund,exists(select 1 from operations.payment_allocations a join operations.payment_disputes d on d.payment_id=a.payment_id where a.invoice_id=${row.id} and d.status not in ('won','warning_closed','prevented')) as dispute`;
  if (adjustments.refund)
    await recordProjectionException(
      tx,
      scope,
      customer.organisationId,
      invoice.id,
      "refund_review",
    );
  if (adjustments.dispute)
    await recordProjectionException(
      tx,
      scope,
      customer.organisationId,
      invoice.id,
      "dispute_review",
    );
  if (invoice.amount_overpaid > 0)
    await recordProjectionException(
      tx,
      scope,
      customer.organisationId,
      invoice.id,
      "overpayment_review",
    );
  for (const credit of snapshot.credits) {
    if (credit.currency !== currency)
      throw new BillingReconciliationError("scope_mismatch");
    await tx`insert into operations.invoice_credits(organisation_id,account_id,environment,invoice_id,provider_credit_id,currency,amount_pence,status) values(${customer.organisationId},${scope.accountId},${scope.mode},${row.id},${credit.providerId},${credit.currency},${credit.amountPence},${credit.status}) on conflict(invoice_id,provider_credit_id) do update set status=excluded.status,projected_at=now()`;
  }
  for (const mandate of snapshot.mandates) {
    if (mandate.customerId !== customer.providerCustomerId)
      throw new BillingReconciliationError("scope_mismatch");
    await applyMandate(tx, scope, mandate);
  }
  if (invoice.status === "uncollectible")
    await recordProjectionException(
      tx,
      scope,
      customer.organisationId,
      invoice.id,
      "uncollectible_review",
    );
  await refreshCollectionsReview(tx, row.id);
  return row.id;
}
async function recordProjectionException(
  tx: OperationsTransaction,
  scope: ProviderScope,
  organisationId: string,
  objectId: string,
  category: string,
): Promise<void> {
  await tx`insert into operations.billing_exceptions(organisation_id,account_id,environment,object_id,category,operation_key) values(${organisationId},${scope.accountId},${scope.mode},${objectId},${category},${`${scope.accountId}:${scope.mode}:${objectId}:${category}`}) on conflict(operation_key) do update set last_seen_at=now()`;
}
