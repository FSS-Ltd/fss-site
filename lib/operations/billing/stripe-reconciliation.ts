import type Stripe from "stripe";
import { z } from "zod";
import {
  BillingReconciliationError,
  type BillingReconciliationProvider,
  type ProviderScope,
  type BillingSetupProjection,
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
      let setupProjection: BillingSetupProjection | null = null;
      let detachedMethodId: string | null = null;
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
      else if (
        event.data.object.object === "payment_method" &&
        event.type === "payment_method.detached"
      ) {
        const method = await client.paymentMethods.retrieve(receipt.objectId);
        requireProviderMode(method, scope);
        if (method.customer !== null)
          throw new BillingReconciliationError("invalid_projection");
        detachedMethodId = method.id;
      } else if (
        event.data.object.object === "checkout.session" &&
        (event.type === "checkout.session.completed" ||
          event.type === "checkout.session.expired")
      ) {
        const session = await client.checkout.sessions.retrieve(
          receipt.objectId,
        );
        requireProviderMode(session, scope);
        const setupId = session.metadata?.operations_setup;
        const customerId = session.customer
          ? providerId(session.customer)
          : null;
        if (
          session.mode === "setup" &&
          z.uuid().safeParse(setupId).success &&
          customerId &&
          session.client_reference_id === setupId &&
          session.metadata?.operations_organisation &&
          session.metadata?.operations_currency
        ) {
          if (event.type === "checkout.session.expired") {
            setupProjection = {
              setupId,
              kind: "checkout.session.expired",
              occurredAt: receipt.occurredAt,
              providerCustomerId: customerId,
              providerSessionId: session.id,
              setupIntentId: null,
              providerMethodId: null,
              mandateId: null,
              method: null,
              metadataOrganisationId: session.metadata.operations_organisation,
              metadataCurrency: session.metadata.operations_currency,
              brand: null,
              last4: null,
              expiresMonth: null,
              expiresYear: null,
            };
          } else {
            if (!session.setup_intent)
              throw new BillingReconciliationError("invalid_projection");
            const intent = await client.setupIntents.retrieve(
              providerId(session.setup_intent),
            );
            requireProviderMode(intent, scope);
            if (intent.status !== "succeeded")
              throw new Error(
                "Billing setup is awaiting provider confirmation.",
              );
            if (
              !intent.payment_method ||
              providerId(intent.customer ?? "") !== customerId ||
              intent.metadata?.operations_setup !== setupId
            )
              throw new BillingReconciliationError("invalid_projection");
            const method = await client.paymentMethods.retrieve(
              providerId(intent.payment_method),
            );
            requireProviderMode(method, scope);
            if (
              providerId(method.customer ?? "") !== customerId ||
              (method.type !== "card" && method.type !== "bacs_debit")
            )
              throw new BillingReconciliationError("scope_mismatch");
            setupProjection = {
              setupId,
              kind: "setup_intent.succeeded",
              occurredAt: receipt.occurredAt,
              providerCustomerId: customerId,
              providerSessionId: session.id,
              setupIntentId: intent.id,
              providerMethodId: method.id,
              mandateId: intent.mandate ? providerId(intent.mandate) : null,
              method: method.type === "card" ? "card" : "bacs_debit",
              metadataOrganisationId: session.metadata.operations_organisation,
              metadataCurrency: session.metadata.operations_currency,
              brand: method.card?.brand ?? null,
              last4: method.card?.last4 ?? method.bacs_debit?.last4 ?? null,
              expiresMonth: method.card?.exp_month ?? null,
              expiresYear: method.card?.exp_year ?? null,
            };
          }
        }
      } else if (event.data.object.object === "setup_intent") {
        const setup = await client.setupIntents.retrieve(receipt.objectId);
        requireProviderMode(setup, scope);
        const setupIdResult = z
          .uuid()
          .safeParse(setup.metadata?.operations_setup);
        if (
          setupIdResult.success &&
          setup.metadata?.operations_organisation &&
          setup.metadata?.operations_currency &&
          setup.customer
        ) {
          const setupId = setupIdResult.data;
          const customerId = providerId(setup.customer);
          if (
            event.type === "setup_intent.setup_failed" &&
            setup.status !== "succeeded"
          ) {
            setupProjection = {
              setupId,
              kind: "setup_intent.setup_failed",
              occurredAt: receipt.occurredAt,
              providerCustomerId: customerId,
              providerSessionId: null,
              setupIntentId: setup.id,
              providerMethodId: null,
              mandateId: null,
              method: null,
              metadataOrganisationId: setup.metadata.operations_organisation,
              metadataCurrency: setup.metadata.operations_currency,
              brand: null,
              last4: null,
              expiresMonth: null,
              expiresYear: null,
            };
          } else if (
            event.type === "setup_intent.succeeded" &&
            setup.status === "succeeded" &&
            setup.payment_method
          ) {
            const method = await client.paymentMethods.retrieve(
              providerId(setup.payment_method),
            );
            requireProviderMode(method, scope);
            if (
              providerId(method.customer ?? "") !== customerId ||
              (method.type !== "card" && method.type !== "bacs_debit")
            )
              throw new BillingReconciliationError("scope_mismatch");
            setupProjection = {
              setupId,
              kind: "setup_intent.succeeded",
              occurredAt: receipt.occurredAt,
              providerCustomerId: customerId,
              providerSessionId: null,
              setupIntentId: setup.id,
              providerMethodId: method.id,
              mandateId: setup.mandate ? providerId(setup.mandate) : null,
              method: method.type === "card" ? "card" : "bacs_debit",
              metadataOrganisationId: setup.metadata.operations_organisation,
              metadataCurrency: setup.metadata.operations_currency,
              brand: method.card?.brand ?? null,
              last4: method.card?.last4 ?? method.bacs_debit?.last4 ?? null,
              expiresMonth: method.card?.exp_month ?? null,
              expiresYear: method.card?.exp_year ?? null,
            };
          }
        }
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
      return {
        invoiceIds,
        mandate,
        ...(setupProjection ? { setup: setupProjection } : {}),
        ...(detachedMethodId ? { detachedMethodId } : {}),
      };
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
