import assert from "node:assert/strict";
import test from "node:test";
import { provisionPortalAccount, readPortalProvisionConfig } from "./provision";

test("provisioning requires a dedicated server secret and enabled portal configuration", () => {
  const env = {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_SUPABASE_URL: "https://portal.example.test",
    OPERATIONS_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    OPERATIONS_SUPABASE_SECRET_KEY: "sb_secret_test",
  };
  assert.equal(readPortalProvisionConfig(env).secretKey, "sb_secret_test");
  assert.throws(() =>
    readPortalProvisionConfig({
      ...env,
      OPERATIONS_SUPABASE_SECRET_KEY: "sb_publishable_test",
    }),
  );
  assert.throws(() =>
    readPortalProvisionConfig({ ...env, OPERATIONS_ENABLED: "false" }),
  );
});
test("provisioning creates only a passwordless account and tolerates existing email", async () => {
  const inputs: unknown[] = [];
  await provisionPortalAccount("Client@example.test", async (input) => {
    inputs.push(input);
    return { error: null };
  });
  assert.deepEqual(inputs, [
    { email: "client@example.test", email_confirm: true },
  ]);
  await provisionPortalAccount("client@example.test", async () => ({
    error: { code: "email_exists" },
  }));
  await assert.rejects(
    provisionPortalAccount("client@example.test", async () => ({
      error: { code: "unexpected" },
    })),
    /unavailable/,
  );
  await assert.rejects(
    provisionPortalAccount("invalid", async () => {
      throw new Error("must not call");
    }),
  );
});
