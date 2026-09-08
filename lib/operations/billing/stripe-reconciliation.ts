import type Stripe from "stripe";
import {
  BillingReconciliationError,
  type BillingReconciliationProvider,
  type ProviderScope,
} from "./reconciliation-types";
import {
  fetchStripeInvoiceProjection,
  fetchStripeMandate,
  requireProviderMode,
  providerId,
} from "./stripe-projections";
function complete<T>(page: { data: T[]; has_more: boolean }): T[] {
  if (page.has_more)
    throw new BillingReconciliationError("incomplete_provider_data");
  return page.data;
}
export function createStripeReconciliationProvider(
  client: Stripe,
  scope: ProviderScope,
): BillingReconciliationProvider {
  async function invoiceIdsForPayment(
    paymentIntentId: string,
  ): Promise<string[]> {
    const payment = await client.paymentIntents.retrieve(paymentIntentId);
    requireProviderMode(payment, scope);
    return complete(
      await client.invoicePayments.list({
        payment: { type: "payment_intent", payment_intent: paymentIntentId },
        limit: 20,
      }),
    ).map((allocation) => {
      requireProviderMode(allocation, scope);
      return providerId(allocation.invoice);
    });
  }
  return {
    scope,
    async resolveEvent(receipt) {
      // Fetch the verified event from this credential's own account. Its payload is never stored.
      const event = await client.events.retrieve(receipt.eventId);
      requireProviderMode(event, scope);
      if (
        receipt.accountId !== scope.accountId ||
        receipt.mode !== scope.mode ||
        event.type !== receipt.eventType ||
        !("id" in event.data.object) ||
        event.data.object.id !== receipt.objectId ||
        (event.account && event.account !== scope.accountId)
      )
        throw new BillingReconciliationError("scope_mismatch");
      let invoiceIds: string[] = [];
      let mandate = null;
      if (event.data.object.object === "invoice") {
        const invoice = await client.invoices.retrieve(receipt.objectId);
        requireProviderMode(invoice, scope);
        if (invoice.status !== "draft") invoiceIds = [invoice.id];
      } else if (event.data.object.object === "invoice_payment") {
        const allocation = await client.invoicePayments.retrieve(
          receipt.objectId,
        );
        requireProviderMode(allocation, scope);
        invoiceIds = [providerId(allocation.invoice)];
      } else if (event.data.object.object === "payment_intent")
        invoiceIds = await invoiceIdsForPayment(receipt.objectId);
      else if (event.data.object.object === "charge") {
        const charge = await client.charges.retrieve(receipt.objectId);
        requireProviderMode(charge, scope);
        if (!charge.payment_intent)
          throw new BillingReconciliationError("unknown_mapping");
        invoiceIds = await invoiceIdsForPayment(
          providerId(charge.payment_intent),
        );
      } else if (event.data.object.object === "refund") {
        const refund = await client.refunds.retrieve(receipt.objectId);
        if (!refund.payment_intent)
          throw new BillingReconciliationError("unknown_mapping");
        invoiceIds = await invoiceIdsForPayment(
          providerId(refund.payment_intent),
        );
      } else if (event.data.object.object === "dispute") {
        const dispute = await client.disputes.retrieve(receipt.objectId);
        requireProviderMode(dispute, scope);
        if (!dispute.payment_intent)
          throw new BillingReconciliationError("unknown_mapping");
        invoiceIds = await invoiceIdsForPayment(
          providerId(dispute.payment_intent),
        );
      } else if (event.data.object.object === "credit_note") {
        const credit = await client.creditNotes.retrieve(receipt.objectId);
        requireProviderMode(credit, scope);
        invoiceIds = [providerId(credit.invoice)];
      } else if (event.data.object.object === "mandate")
        mandate = await fetchStripeMandate(client, scope, receipt.objectId);
      else if (event.data.object.object === "setup_intent") {
        const setup = await client.setupIntents.retrieve(receipt.objectId);
        requireProviderMode(setup, scope);
        if (setup.mandate)
          mandate = await fetchStripeMandate(
            client,
            scope,
            providerId(setup.mandate),
          );
      } else if (event.data.object.object === "subscription") {
        const subscription = await client.subscriptions.retrieve(
          receipt.objectId,
        );
        requireProviderMode(subscription, scope);
        invoiceIds = complete(
          await client.invoices.list({
            subscription: subscription.id,
            limit: 20,
          }),
        )
          .filter((invoice) => invoice.status !== "draft")
          .map((invoice) => invoice.id);
      }
      return { invoiceIds, mandate };
    },
    fetchInvoice: (id) => fetchStripeInvoiceProjection(client, scope, id),
    async listInvoices(cursor, limit) {
      const page = await client.invoices.list({
        limit,
        ...(cursor ? { starting_after: cursor } : {}),
      });
      for (const invoice of page.data) requireProviderMode(invoice, scope);
      return {
        invoiceIds: page.data
          .filter((invoice) => invoice.status !== "draft")
          .map((invoice) => invoice.id),
        cursor: page.has_more ? (page.data.at(-1)?.id ?? null) : null,
      };
    },
  };
}
