import type { BillingConfiguration, BillingEnvironment } from "./types";

export function readBillingConfiguration(
  env: BillingEnvironment = process.env,
): BillingConfiguration {
  if (
    env.OPERATIONS_ENABLED !== "true" ||
    env.OPERATIONS_BILLING_ENABLED !== "true"
  ) {
    return { enabled: false };
  }

  const mode = env.STRIPE_MODE;
  const secretKey = env.STRIPE_SECRET_KEY;
  const accountId = env.STRIPE_ACCOUNT_ID;
  if (
    (mode !== "test" && mode !== "live") ||
    !secretKey ||
    !new RegExp(`^(sk|rk)_${mode}_[A-Za-z0-9]+$`).test(secretKey) ||
    !accountId ||
    !/^acct_[A-Za-z0-9]+$/.test(accountId)
  ) {
    throw new Error("Operations billing is not configured correctly.");
  }

  // Preview builds also use NODE_ENV=production, so require both signals.
  if (
    mode === "live" &&
    (env.NODE_ENV !== "production" || env.VERCEL_ENV !== "production")
  ) {
    throw new Error(
      "Live Operations billing requires a production deployment.",
    );
  }

  return { enabled: true, provider: "stripe", mode, accountId, secretKey };
}
