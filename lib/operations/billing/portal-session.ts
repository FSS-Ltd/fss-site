import type Stripe from "stripe";
import type { BillingMode } from "./types";

type Configuration = Pick<
  Stripe.BillingPortal.Configuration,
  "active" | "livemode"
> & {
  features: {
    [K in
      | "invoice_history"
      | "payment_method_update"
      | "subscription_cancel"
      | "subscription_update"
      | "customer_update"]: { enabled: boolean };
  };
};
export type HostedBillingProvider = {
  retrieveConfiguration: (id: string) => Promise<Configuration>;
  createSession: (input: {
    customer: string;
    configuration: string;
    return_url: string;
  }) => Promise<
    Pick<Stripe.BillingPortal.Session, "customer" | "livemode" | "url">
  >;
  retrieveInvoice: (
    id: string,
  ) => Promise<
    Pick<Stripe.Invoice, "customer" | "livemode" | "hosted_invoice_url">
  >;
};

export function hostedBillingProvider(stripe: Stripe): HostedBillingProvider {
  return {
    retrieveConfiguration: (id) =>
      stripe.billingPortal.configurations.retrieve(id),
    createSession: (input) => stripe.billingPortal.sessions.create(input),
    retrieveInvoice: (id) => stripe.invoices.retrieve(id),
  };
}

function trustedHostedUrl(
  value: string | null | undefined,
  hostname: string,
): string {
  if (!value) throw new Error("Hosted billing is unavailable.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== hostname ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Hosted billing is unavailable.");
  return url.href;
}

export async function createHostedBillingSession(
  provider: HostedBillingProvider,
  input: {
    customerId: string;
    configurationId: string;
    mode: BillingMode;
    returnUrl: string;
  },
): Promise<string> {
  const configuration = await provider.retrieveConfiguration(
    input.configurationId,
  );
  const { features } = configuration;
  if (
    !configuration.active ||
    configuration.livemode !== (input.mode === "live") ||
    !features.invoice_history.enabled ||
    !features.payment_method_update.enabled ||
    features.subscription_cancel.enabled ||
    features.subscription_update.enabled ||
    features.customer_update.enabled
  )
    throw new Error("Hosted billing configuration requires review.");
  const session = await provider.createSession({
    customer: input.customerId,
    configuration: input.configurationId,
    return_url: input.returnUrl,
  });
  if (
    session.customer !== input.customerId ||
    session.livemode !== (input.mode === "live")
  )
    throw new Error("Hosted billing is unavailable.");
  return trustedHostedUrl(session.url, "billing.stripe.com");
}

export async function getHostedInvoiceUrl(
  provider: HostedBillingProvider,
  input: { customerId: string; providerInvoiceId: string; mode: BillingMode },
): Promise<string> {
  const invoice = await provider.retrieveInvoice(input.providerInvoiceId);
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (
    customerId !== input.customerId ||
    invoice.livemode !== (input.mode === "live")
  )
    throw new Error("Hosted invoice is unavailable.");
  return trustedHostedUrl(invoice.hosted_invoice_url, "invoice.stripe.com");
}
