import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { createOperationsBillingClient } from "./client";
import type { BillingEnvironment } from "./types";

const sandbox: BillingEnvironment = {
  OPERATIONS_ENABLED: "true",
  OPERATIONS_BILLING_ENABLED: "true",
  STRIPE_MODE: "test",
  STRIPE_ACCOUNT_ID: "acct_fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
};

test("disabled and invalid configuration never instantiate a provider client", async () => {
  const createStripe = () => {
    assert.fail("Provider client must not be constructed");
  };
  assert.equal(await createOperationsBillingClient({}, createStripe), null);
  await assert.rejects(
    createOperationsBillingClient(
      { ...sandbox, STRIPE_MODE: undefined },
      createStripe,
    ),
    { message: "Operations billing is not configured correctly." },
  );
});

test("client pins transport limits and verifies its own account before returning", async (t) => {
  let factoryCalls = 0;
  const client = new Stripe("sk_test_fixture");
  const retrieve = t.mock.method(client.accounts, "retrieve", async () => ({
    id: "acct_fixture",
  }));
  const result = await createOperationsBillingClient(
    sandbox,
    (secretKey, options) => {
      factoryCalls += 1;
      assert.equal(secretKey, "sk_test_fixture");
      assert.deepEqual(options, {
        apiVersion: "2026-08-26.dahlia",
        timeout: 10_000,
        maxNetworkRetries: 1,
        telemetry: false,
      });
      return client;
    },
  );
  assert.equal(result, client);
  assert.equal(factoryCalls, 1);
  assert.equal(retrieve.mock.callCount(), 1);
  assert.deepEqual(retrieve.mock.calls[0].arguments, [null]);
});

test("wrong account binding never returns a ready client", async (t) => {
  const client = new Stripe("sk_test_fixture");
  t.mock.method(client.accounts, "retrieve", async () => ({
    id: "acct_other",
  }));
  await assert.rejects(
    createOperationsBillingClient(sandbox, () => client),
    {
      message: "Operations billing provider verification failed.",
    },
  );
});

test("provider failures are redacted and cannot silently skip account verification", async (t) => {
  const client = new Stripe("rk_test_fixture");
  t.mock.method(client.accounts, "retrieve", async () => {
    throw new Error("Denied rk_test_fixture for acct_fixture");
  });
  await assert.rejects(
    createOperationsBillingClient(sandbox, () => client),
    {
      message: "Operations billing provider verification failed.",
    },
  );
  await assert.rejects(
    createOperationsBillingClient(sandbox, () => {
      throw new Error("Invalid sk_test_fixture");
    }),
    { message: "Operations billing provider verification failed." },
  );
});
