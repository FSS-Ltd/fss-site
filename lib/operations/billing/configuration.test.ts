import assert from "node:assert/strict";
import test from "node:test";
import { readBillingConfiguration } from "./configuration";
import type { BillingEnvironment } from "./types";

const sandbox: BillingEnvironment = {
  OPERATIONS_ENABLED: "true",
  OPERATIONS_BILLING_ENABLED: "true",
  STRIPE_MODE: "test",
  STRIPE_ACCOUNT_ID: "acct_fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
};

test("billing remains disabled unless both flags are explicitly true", () => {
  assert.deepEqual(readBillingConfiguration({}), { enabled: false });
  for (const flag of ["OPERATIONS_ENABLED", "OPERATIONS_BILLING_ENABLED"]) {
    for (const value of [undefined, "", "false", "TRUE", "1"]) {
      assert.deepEqual(
        readBillingConfiguration({ ...sandbox, [flag]: value }),
        { enabled: false },
      );
    }
  }
});

test("sandbox accepts secret and restricted server keys without a publishable key", () => {
  for (const secretKey of ["sk_test_fixture", "rk_test_fixture"]) {
    assert.deepEqual(
      readBillingConfiguration({ ...sandbox, STRIPE_SECRET_KEY: secretKey }),
      {
        enabled: true,
        provider: "stripe",
        mode: "test",
        accountId: "acct_fixture",
        secretKey,
      },
    );
  }
});

test("billing rejects missing, malformed and cross-mode configuration without exposing values", () => {
  const invalid: BillingEnvironment[] = [
    { STRIPE_MODE: undefined },
    { STRIPE_MODE: "sandbox" },
    { STRIPE_SECRET_KEY: undefined },
    { STRIPE_SECRET_KEY: "sk_live_fixture" },
    { STRIPE_SECRET_KEY: "rk_live_fixture" },
    { STRIPE_SECRET_KEY: "pk_test_fixture" },
    { STRIPE_SECRET_KEY: "sk_test_" },
    { STRIPE_SECRET_KEY: " sk_test_fixture" },
    { STRIPE_SECRET_KEY: "sk_test_fixture\n" },
    { STRIPE_ACCOUNT_ID: undefined },
    { STRIPE_ACCOUNT_ID: "acct_" },
    { STRIPE_ACCOUNT_ID: "customer_fixture" },
    { STRIPE_ACCOUNT_ID: "acct_fixture\n" },
    { STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_test_fixture" },
  ];
  for (const override of invalid) {
    assert.throws(() => readBillingConfiguration({ ...sandbox, ...override }), {
      message: "Operations billing is not configured correctly.",
    });
  }
});

test("live billing requires both explicit production environment signals", () => {
  const live = {
    ...sandbox,
    STRIPE_MODE: "live",
    STRIPE_SECRET_KEY: "rk_live_fixture",
  };
  for (const nodeEnv of [undefined, "development", "test", "production"]) {
    for (const vercelEnv of [
      undefined,
      "development",
      "preview",
      "production",
    ]) {
      const env = { ...live, NODE_ENV: nodeEnv, VERCEL_ENV: vercelEnv };
      if (nodeEnv === "production" && vercelEnv === "production") {
        assert.equal(readBillingConfiguration(env).enabled, true);
      } else {
        assert.throws(() => readBillingConfiguration(env), {
          message: "Live Operations billing requires a production deployment.",
        });
      }
    }
  }
});
