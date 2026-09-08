import type Stripe from "stripe";
import type { BillingCommand } from "./command-repository";
import {
  commandProviderId,
  commandInvoiceId,
  requireSafeReplay,
} from "./command-repository";
import type { BillingSchedule } from "./domain-types";
export type ProviderObligation = {
  providerId: string;
  invoice: Stripe.Invoice | null;
};
export function stripeAmount(pence: string): number {
  const value = BigInt(pence);
  if (value < BigInt(0) || value > BigInt(99999999))
    throw new Error(
      "Signed billing amount exceeds the supported Stripe GBP amount range.",
    );
  return Number(value);
}
function timestamp(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 1000;
}
export async function createStripeObligation(
  stripe: Stripe,
  schedule: BillingSchedule,
  customerId: string,
  command: BillingCommand,
): Promise<ProviderObligation> {
  const amount = stripeAmount(schedule.amountPence);
  const metadata = {
    operations_command: command.id,
    operations_schedule: schedule.id,
    operations_organisation: schedule.organisationId,
  };
  const key = (step: string) => ({
    idempotencyKey: `operations:${command.id}:${step}`,
  });
  const reference = commandProviderId(command);
  if (reference) {
    // Completed issuance never follows latest_invoice or mutates provider renewal state.
    const invoiceId =
      commandInvoiceId(command) ??
      (schedule.owner === "invoice" ? reference : null);
    const invoice = invoiceId
      ? await stripe.invoices.retrieve(invoiceId)
      : null;
    if (
      invoice &&
      (invoice.customer !== customerId ||
        invoice.livemode !== (schedule.mode === "live") ||
        invoice.currency !== "gbp")
    )
      throw new Error("Provider invoice context mismatch.");
    return { providerId: reference, invoice };
  }
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || customer.livemode !== (schedule.mode === "live"))
    throw new Error("Provider customer environment mismatch.");
  const initialInvoice = async (
    subscription: Stripe.Subscription,
  ): Promise<Stripe.Invoice | null> => {
    if (
      subscription.customer !== customerId ||
      subscription.livemode !== (schedule.mode === "live")
    )
      throw new Error("Provider subscription context mismatch.");
    const invoiceId =
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;
    if (!invoiceId) return null;
    let invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.billing_reason !== "subscription_create")
      throw new Error(
        "Initial subscription invoice needs reconciliation; renewal invoices belong to provider processing.",
      );
    if (
      invoice.customer !== customerId ||
      invoice.livemode !== (schedule.mode === "live") ||
      invoice.currency !== "gbp" ||
      invoice.total !== amount
    )
      throw new Error(
        "Provider recurring invoice differs from signed obligation.",
      );
    if (invoice.status === "draft")
      invoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        { auto_advance: true },
        key("finalize"),
      );
    return invoice;
  };
  if (schedule.owner === "invoice") {
    let invoice: Stripe.Invoice | undefined;
    if (reference) invoice = await stripe.invoices.retrieve(reference);
    else {
      const candidates = await stripe.invoices.list({
        customer: customerId,
        limit: 100,
      });
      const matches = candidates.data.filter(
        (item) => item.metadata?.operations_command === command.id,
      );
      if (matches.length > 1)
        throw new Error("Multiple invoices require provider reconciliation.");
      invoice = matches[0];
    }
    if (!invoice) {
      requireSafeReplay(command.createdAt);
      invoice = await stripe.invoices.create(
        {
          customer: customerId,
          currency: "gbp",
          collection_method: "send_invoice",
          due_date: timestamp(schedule.dueDate),
          auto_advance: false,
          pending_invoice_items_behavior: "exclude",
          automatic_tax: { enabled: false },
          metadata,
        },
        key("invoice"),
      );
    }
    if (
      invoice.customer !== customerId ||
      invoice.livemode !== (schedule.mode === "live")
    )
      throw new Error("Provider invoice context mismatch.");
    if (invoice.status === "draft") {
      const items = await stripe.invoiceItems.list({
        invoice: invoice.id,
        limit: 100,
      });
      const existing = items.data.filter(
        (item) => item.metadata?.operations_command === command.id,
      );
      if (existing.length > 1)
        throw new Error("Multiple invoice items require reconciliation.");
      if (!existing.length) {
        requireSafeReplay(command.createdAt);
        await stripe.invoiceItems.create(
          {
            customer: customerId,
            invoice: invoice.id,
            currency: "gbp",
            amount,
            description: schedule.description,
            metadata,
          },
          key("item"),
        );
      }
      const ready = await stripe.invoices.retrieve(invoice.id);
      if (ready.total !== amount)
        throw new Error(
          "Provider invoice total differs from signed obligation.",
        );
      invoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        { auto_advance: false },
        key("finalize"),
      );
    }
    if (invoice.total !== amount)
      throw new Error("Provider invoice total differs from signed obligation.");
    return { providerId: invoice.id, invoice };
  }
  const start = timestamp(schedule.dueDate);
  const createdDay = new Date(command.createdAt).toISOString().slice(0, 10);
  if (schedule.dueDate < createdDay)
    throw new Error(
      "Past recurring start requires founder-reviewed recovery; billing cannot silently shift the signed date.",
    );
  if (schedule.endDate && timestamp(schedule.endDate) <= start)
    throw new Error("Recurring end must follow its start.");
  const future = schedule.dueDate > createdDay;
  // Retrieve ownership before creating anything. No collection loop runs in this application.
  if (future) {
    let provider: Stripe.SubscriptionSchedule | undefined = reference
      ? await stripe.subscriptionSchedules.retrieve(reference)
      : undefined;
    if (!provider) {
      const list = await stripe.subscriptionSchedules.list({
        customer: customerId,
        limit: 100,
      });
      const matches = list.data.filter(
        (item) => item.metadata?.operations_command === command.id,
      );
      if (matches.length > 1)
        throw new Error("Multiple provider schedules require reconciliation.");
      provider = matches[0];
    }
    if (provider) {
      if (
        provider.customer !== customerId ||
        provider.livemode !== (schedule.mode === "live")
      )
        throw new Error("Provider schedule context mismatch.");
      return { providerId: provider.id, invoice: null };
    }
  } else {
    let provider: Stripe.Subscription | undefined = reference
      ? await stripe.subscriptions.retrieve(reference)
      : undefined;
    if (!provider) {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      const matches = list.data.filter(
        (item) => item.metadata.operations_command === command.id,
      );
      if (matches.length > 1)
        throw new Error(
          "Multiple provider subscriptions require reconciliation.",
        );
      provider = matches[0];
    }
    if (provider)
      return {
        providerId: provider.id,
        invoice: await initialInvoice(provider),
      };
  }
  requireSafeReplay(command.createdAt);
  const product = await stripe.products.create(
    { name: schedule.description.slice(0, 250), metadata },
    key("product"),
  );
  const priceData = {
    currency: "gbp",
    product: product.id,
    unit_amount: amount,
    tax_behavior: "inclusive" as const,
    recurring: {
      interval: "month" as const,
      interval_count: schedule.recurrenceMonths,
    },
  };
  if (future) {
    const provider = await stripe.subscriptionSchedules.create(
      {
        customer: customerId,
        start_date: start,
        end_behavior: schedule.endDate ? "cancel" : "release",
        metadata,
        default_settings: {
          collection_method: "send_invoice",
          invoice_settings: { days_until_due: 0 },
          automatic_tax: { enabled: false },
        },
        phases: [
          {
            items: [{ price_data: priceData, quantity: 1 }],
            proration_behavior: "none",
            ...(schedule.endDate
              ? { end_date: timestamp(schedule.endDate) }
              : {
                  duration: {
                    interval: "month" as const,
                    interval_count: schedule.recurrenceMonths,
                  },
                }),
          },
        ],
      },
      key("schedule"),
    );
    return { providerId: provider.id, invoice: null };
  }
  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 0,
      items: [{ price_data: priceData, quantity: 1 }],
      metadata,
      proration_behavior: "none",
      automatic_tax: { enabled: false },
      ...(schedule.endDate ? { cancel_at: timestamp(schedule.endDate) } : {}),
    },
    key("subscription"),
  );
  return {
    providerId: subscription.id,
    invoice: await initialInvoice(subscription),
  };
}
