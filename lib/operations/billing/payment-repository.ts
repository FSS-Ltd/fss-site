import type { OperationsTransaction } from "../db/client";
import {
  BillingReconciliationError,
  type PaymentProjection,
  type ProviderScope,
} from "./reconciliation-types";

/** Caller holds the invoice row lock. Confirmed funds and applied obligation amounts are separate. */
export async function applyPaymentProjection(
  tx: OperationsTransaction,
  scope: ProviderScope,
  organisationId: string,
  invoiceId: string,
  payment: PaymentProjection,
): Promise<void> {
  const [prior] = await tx<
    { id: string; organisationId: string }[]
  >`select id,organisation_id as "organisationId" from operations.payments where account_id=${scope.accountId} and environment=${scope.mode} and provider_payment_id=${payment.providerId}`;
  if (prior && prior.organisationId !== organisationId)
    throw new BillingReconciliationError("scope_mismatch");
  const [updated] = await tx<
    { id: string }[]
  >`insert into operations.payments(organisation_id,account_id,environment,provider_payment_id,state,method,amount_pence,received_pence,confirmed_at,failure_code,provider_mandate_id,provider_created_at,projected_at) values(${organisationId},${scope.accountId},${scope.mode},${payment.providerId},${payment.state},${payment.method},${payment.amountPence},${payment.receivedPence},${payment.confirmedAt},${payment.failureCode},${payment.providerMandateId},${payment.createdAt},${payment.observedAt}) on conflict(account_id,environment,provider_payment_id) do update set state=excluded.state,method=excluded.method,received_pence=excluded.received_pence,confirmed_at=coalesce(payments.confirmed_at,excluded.confirmed_at),failure_code=excluded.failure_code,provider_mandate_id=excluded.provider_mandate_id,projected_at=excluded.projected_at where payments.projected_at<excluded.projected_at returning id`;
  const [stored] = updated
    ? [updated]
    : await tx<
        { id: string }[]
      >`select id from operations.payments where account_id=${scope.accountId} and environment=${scope.mode} and provider_payment_id=${payment.providerId}`;
  const [allocation] = await tx<
    { applied: string | null; providerPaid: string | null; available: string }[]
  >`select (select a.amount_pence::text from operations.payment_allocations a where a.invoice_id=i.id and a.payment_id=${stored.id}) as applied,(select a.provider_paid_pence::text from operations.payment_allocations a where a.invoice_id=i.id and a.payment_id=${stored.id}) as "providerPaid",greatest(0,i.amount_due_pence-coalesce((select sum(a.amount_pence) from operations.payment_allocations a where a.invoice_id=i.id and a.payment_id<>${stored.id}),0))::text as available from operations.invoices i where i.id=${invoiceId}`;
  const confirmed = BigInt(payment.allocationPence),
    available = BigInt(allocation.available);
  const applied =
    allocation.providerPaid !== null &&
    BigInt(allocation.providerPaid) > BigInt(0)
      ? allocation.applied
      : (confirmed < available ? confirmed : available).toString();
  await tx`insert into operations.payment_allocations(organisation_id,invoice_id,payment_id,provider_allocation_id,amount_pence,provider_paid_pence) values(${organisationId},${invoiceId},${stored.id},${payment.allocationId},${applied},${payment.allocationPence}) on conflict(payment_id,invoice_id) do update set amount_pence=excluded.amount_pence,provider_paid_pence=excluded.provider_paid_pence`;
  for (const refund of payment.refunds)
    await tx`insert into operations.payment_refunds(organisation_id,account_id,environment,payment_id,provider_refund_id,amount_pence,status,projected_at) values(${organisationId},${scope.accountId},${scope.mode},${stored.id},${refund.providerId},${refund.amountPence},${refund.status},${payment.observedAt}) on conflict(payment_id,provider_refund_id) do update set status=excluded.status,projected_at=excluded.projected_at where payment_refunds.projected_at<excluded.projected_at`;
  for (const dispute of payment.disputes)
    await tx`insert into operations.payment_disputes(organisation_id,account_id,environment,payment_id,provider_dispute_id,amount_pence,status,projected_at) values(${organisationId},${scope.accountId},${scope.mode},${stored.id},${dispute.providerId},${dispute.amountPence},${dispute.status},${payment.observedAt}) on conflict(payment_id,provider_dispute_id) do update set status=excluded.status,projected_at=excluded.projected_at where payment_disputes.projected_at<excluded.projected_at`;
}
