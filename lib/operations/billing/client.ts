import Stripe from "stripe";
import { readBillingConfiguration } from "./configuration";
import type { BillingEnvironment } from "./types";

export const BILLING_STRIPE_API_VERSION = "2026-08-26.dahlia";

type StripeFactory = (
  secretKey: string,
  options: Stripe.StripeConfig,
) => Stripe;

export async function createOperationsBillingClient(
  env: BillingEnvironment = process.env,
  createStripe: StripeFactory = (secretKey, options) =>
    new Stripe(secretKey, options),
): Promise<Stripe | null> {
  const configuration = readBillingConfiguration(env);
  if (!configuration.enabled) return null;

  try {
    const client = createStripe(configuration.secretKey, {
      apiVersion: BILLING_STRIPE_API_VERSION,
      timeout: 10_000,
      maxNetworkRetries: 1,
      telemetry: false,
    });
    // Query the credential's own account, without a Connect account override.
    const account = await client.accounts.retrieve(null);
    if (account.id !== configuration.accountId) {
      throw new Error("Operations billing account does not match.");
    }
    return client;
  } catch {
    // Provider errors can contain credentials or account details.
    throw new Error("Operations billing provider verification failed.");
  }
}
