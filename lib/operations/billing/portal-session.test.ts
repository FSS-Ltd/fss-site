import assert from "node:assert/strict";
import test from "node:test";
import {
  createHostedBillingSession,
  getHostedInvoiceUrl,
  type HostedBillingProvider,
} from "./portal-session";

function provider(
  overrides: Partial<HostedBillingProvider> = {},
): HostedBillingProvider {
  return {
    retrieveConfiguration: async () => ({
      active: true,
      livemode: false,
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
        customer_update: { enabled: false },
      },
    }),
    createSession: async (input) => ({
      customer: input.customer,
      livemode: false,
      url: "https://billing.stripe.com/p/session/synthetic",
    }),
    retrieveInvoice: async () => ({
      customer: "cus_synthetic",
      livemode: false,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
    }),
    ...overrides,
  };
}
const input = {
  customerId: "cus_synthetic",
  configurationId: "bpc_synthetic",
  mode: "test" as const,
  returnUrl: "https://fss.test/portal/billing",
};
test("hosted session uses stored customer and explicit restricted configuration", async () => {
  let parameters: unknown;
  const url = await createHostedBillingSession(
    provider({
      createSession: async (value) => {
        parameters = value;
        return {
          customer: value.customer,
          livemode: false,
          url: "https://billing.stripe.com/p/session/synthetic",
        };
      },
    }),
    input,
  );
  assert.equal(url, "https://billing.stripe.com/p/session/synthetic");
  assert.deepEqual(parameters, {
    customer: input.customerId,
    configuration: input.configurationId,
    return_url: input.returnUrl,
  });
});
test("hosted configuration that permits cancellation or price changes cannot create a session", async () => {
  for (const feature of [
    "subscription_cancel",
    "subscription_update",
    "customer_update",
  ] as const) {
    const deps = provider();
    const configuration = await deps.retrieveConfiguration("bpc_synthetic");
    configuration.features[feature].enabled = true;
    await assert.rejects(
      createHostedBillingSession(
        provider({
          retrieveConfiguration: async () => configuration,
          createSession: async () => {
            assert.fail("Unsafe configuration reached session creation");
          },
        }),
        input,
      ),
    );
  }
});
test("inactive, wrong-mode and missing management configurations fail closed", async () => {
  for (const variant of [
    "inactive",
    "live",
    "no-history",
    "no-update",
  ] as const) {
    const configuration =
      await provider().retrieveConfiguration("bpc_synthetic");
    if (variant === "inactive") configuration.active = false;
    if (variant === "live") configuration.livemode = true;
    if (variant === "no-history")
      configuration.features.invoice_history.enabled = false;
    if (variant === "no-update")
      configuration.features.payment_method_update.enabled = false;
    await assert.rejects(
      createHostedBillingSession(
        provider({ retrieveConfiguration: async () => configuration }),
        input,
      ),
    );
  }
});
test("invoice lookup checks provider customer and environment before returning a hosted link", async () => {
  assert.equal(
    await getHostedInvoiceUrl(provider(), {
      customerId: input.customerId,
      providerInvoiceId: "in_synthetic",
      mode: "test",
    }),
    "https://invoice.stripe.com/i/synthetic",
  );
  for (const invoice of [
    {
      customer: "cus_other",
      livemode: false,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
    },
    {
      customer: "cus_synthetic",
      livemode: true,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com/i/synthetic",
    },
    {
      customer: "cus_synthetic",
      livemode: false,
      currency: "gbp",
      hosted_invoice_url: null,
    },
    {
      customer: "cus_synthetic",
      livemode: false,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com.evil.test/i/synthetic",
    },
  ])
    await assert.rejects(
      getHostedInvoiceUrl(provider({ retrieveInvoice: async () => invoice }), {
        customerId: input.customerId,
        providerInvoiceId: "in_synthetic",
        mode: "test",
      }),
    );
});
test("session responses cannot redirect to another account or an untrusted URL", async () => {
  for (const session of [
    {
      customer: "cus_other",
      livemode: false,
      url: "https://billing.stripe.com/p/session/synthetic",
    },
    {
      customer: input.customerId,
      livemode: true,
      url: "https://billing.stripe.com/p/session/synthetic",
    },
    {
      customer: input.customerId,
      livemode: false,
      url: "https://billing.stripe.com@evil.test/session",
    },
  ])
    await assert.rejects(
      createHostedBillingSession(
        provider({ createSession: async () => session }),
        input,
      ),
    );
});
