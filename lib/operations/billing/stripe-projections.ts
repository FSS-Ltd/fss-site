import type Stripe from "stripe";
import {
  BillingReconciliationError,
  type InvoiceReconciliation,
  type MandateProjection,
  type PaymentProjection,
  type ProviderScope,
} from "./reconciliation-types";
export function providerId(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}
export function requireProviderMode(
  value: { livemode: boolean },
  scope: ProviderScope,
): void {
  if (value.livemode !== (scope.mode === "live"))
    throw new BillingReconciliationError("scope_mismatch");
}
function money(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new BillingReconciliationError("invalid_projection");
  return String(value);
}
function complete<T>(page: { data: T[]; has_more: boolean }): T[] {
  if (page.has_more)
    throw new BillingReconciliationError("incomplete_provider_data");
  return page.data;
}
export async function fetchStripeMandate(
  client: Stripe,
  scope: ProviderScope,
  id: string,
): Promise<MandateProjection> {
  const observedAt = new Date().toISOString();
  const mandate = await client.mandates.retrieve(id);
  requireProviderMode(mandate, scope);
  const method = await client.paymentMethods.retrieve(
    providerId(mandate.payment_method),
  );
  requireProviderMode(method, scope);
  if (!method.customer) throw new BillingReconciliationError("unknown_mapping");
  if (!["active", "inactive", "pending"].includes(mandate.status))
    throw new BillingReconciliationError("invalid_projection");
  const status =
    mandate.status === "active"
      ? "active"
      : mandate.status === "inactive"
        ? "inactive"
        : "pending";
  return {
    providerId: id,
    customerId: providerId(method.customer),
    status,
    observedAt,
  };
}
async function fetchPayment(
  client: Stripe,
  scope: ProviderScope,
  allocation: Stripe.InvoicePayment,
  customerId: string,
): Promise<{ payment: PaymentProjection; mandate: MandateProjection | null }> {
  const observedAt = new Date().toISOString();
  requireProviderMode(allocation, scope);
  if (
    allocation.currency !== "gbp" ||
    allocation.payment.type !== "payment_intent" ||
    !allocation.payment.payment_intent
  )
    throw new BillingReconciliationError("incomplete_provider_data");
  const intent = await client.paymentIntents.retrieve(
    providerId(allocation.payment.payment_intent),
  );
  requireProviderMode(intent, scope);
  if (
    intent.currency !== "gbp" ||
    !intent.customer ||
    providerId(intent.customer) !== customerId
  )
    throw new BillingReconciliationError("scope_mismatch");
  const charge = intent.latest_charge
    ? await client.charges.retrieve(providerId(intent.latest_charge))
    : null;
  if (charge) {
    requireProviderMode(charge, scope);
    if (
      providerId(charge.payment_intent ?? "") !== intent.id ||
      providerId(charge.customer ?? "") !== customerId
    )
      throw new BillingReconciliationError("scope_mismatch");
  }
  const refunds = charge
    ? complete(await client.refunds.list({ charge: charge.id, limit: 20 }))
    : [];
  const disputes = complete(
    await client.disputes.list({ payment_intent: intent.id, limit: 20 }),
  );
  for (const dispute of disputes) {
    requireProviderMode(dispute, scope);
    if (providerId(dispute.payment_intent ?? "") !== intent.id)
      throw new BillingReconciliationError("scope_mismatch");
  }
  const methodType =
    charge?.payment_method_details?.type ??
    intent.last_payment_error?.payment_method?.type;
  const mandateId = charge?.payment_method_details?.bacs_debit?.mandate;
  const mandate = mandateId
    ? await fetchStripeMandate(client, scope, mandateId)
    : null;
  const state: PaymentProjection["state"] =
    intent.status === "succeeded"
      ? "succeeded"
      : intent.status === "processing"
        ? "processing"
        : intent.status === "canceled"
          ? "canceled"
          : intent.last_payment_error
            ? "failed"
            : "pending";
  return {
    mandate,
    payment: {
      providerId: intent.id,
      customerId,
      state,
      method:
        methodType === "card" || methodType === "bacs_debit"
          ? methodType
          : "other",
      amountPence: money(intent.amount),
      receivedPence: money(intent.amount_received),
      // Retain the provider invoice-payment confirmation timestamp; another allocation cannot overwrite it.
      confirmedAt:
        state === "succeeded"
          ? new Date(
              (allocation.status_transitions.paid_at ??
                charge?.created ??
                intent.created) * 1000,
            ).toISOString()
          : null,
      failureCode:
        intent.last_payment_error?.decline_code ??
        intent.last_payment_error?.code ??
        null,
      observedAt,
      createdAt: new Date(intent.created * 1000).toISOString(),
      providerMandateId: mandateId ?? null,
      allocationId: allocation.id,
      allocationPence: money(allocation.amount_paid ?? 0),
      refunds: refunds.map((refund) => ({
        providerId: refund.id,
        amountPence: money(refund.amount),
        status: refund.status ?? "pending",
      })),
      disputes: disputes.map((dispute) => ({
        providerId: dispute.id,
        amountPence: money(dispute.amount),
        status: dispute.status,
      })),
    },
  };
}
export async function fetchStripeInvoiceProjection(
  client: Stripe,
  scope: ProviderScope,
  id: string,
): Promise<InvoiceReconciliation> {
  const invoice = await client.invoices.retrieve(id);
  requireProviderMode(invoice, scope);
  if (invoice.currency !== "gbp" || !invoice.customer)
    throw new BillingReconciliationError("scope_mismatch");
  money(invoice.total);
  money(invoice.amount_due);
  money(invoice.amount_overpaid);
  money(invoice.amount_paid);
  money(invoice.amount_remaining);
  if (invoice.lines.has_more)
    invoice.lines = await client.invoices.listLineItems(id, { limit: 100 });
  complete(invoice.lines);
  const customerId = providerId(invoice.customer);
  const subscriptionId = invoice.parent?.subscription_details?.subscription
    ? providerId(invoice.parent.subscription_details.subscription)
    : null;
  let subscriptionScheduleId: string | null = null;
  if (subscriptionId) {
    const subscription = await client.subscriptions.retrieve(subscriptionId);
    requireProviderMode(subscription, scope);
    if (providerId(subscription.customer) !== customerId)
      throw new BillingReconciliationError("scope_mismatch");
    subscriptionScheduleId = subscription.schedule
      ? providerId(subscription.schedule)
      : null;
    if (!subscriptionScheduleId) {
      const schedules = complete(
        await client.subscriptionSchedules.list({
          customer: customerId,
          limit: 100,
        }),
      );
      const matching = schedules.filter(
        (schedule) =>
          schedule.released_subscription === subscriptionId ||
          (schedule.subscription &&
            providerId(schedule.subscription) === subscriptionId),
      );
      for (const schedule of matching) requireProviderMode(schedule, scope);
      if (matching.length > 1)
        throw new BillingReconciliationError("invalid_projection");
      subscriptionScheduleId = matching[0]?.id ?? null;
    }
  }
  const allocations = complete(
    await client.invoicePayments.list({ invoice: id, limit: 20 }),
  );
  const payments: PaymentProjection[] = [];
  const mandates: MandateProjection[] = [];
  for (const allocation of allocations) {
    if (providerId(allocation.invoice) !== id)
      throw new BillingReconciliationError("scope_mismatch");
    const result = await fetchPayment(client, scope, allocation, customerId);
    payments.push(result.payment);
    if (result.mandate) mandates.push(result.mandate);
  }
  const credits = complete(
    await client.creditNotes.list({ invoice: id, limit: 20 }),
  );
  for (const credit of credits) {
    requireProviderMode(credit, scope);
    if (providerId(credit.invoice) !== id)
      throw new BillingReconciliationError("scope_mismatch");
  }
  return {
    invoice,
    customerId,
    subscriptionId,
    subscriptionScheduleId,
    payments,
    mandates,
    credits: credits.map((credit) => ({
      providerId: credit.id,
      amountPence: money(credit.amount),
      status: credit.status,
    })),
  };
}
