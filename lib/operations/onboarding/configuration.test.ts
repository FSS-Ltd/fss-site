import assert from "node:assert/strict";
import test from "node:test";
import { readOnboardingConfiguration } from "./configuration";
test("onboarding configuration is exact-gated and requires isolated credentials and HTTPS origin", () => {
  assert.deepEqual(readOnboardingConfiguration({}), { enabled: false });
  assert.deepEqual(
    readOnboardingConfiguration({
      OPERATIONS_ENABLED: "true",
      OPERATIONS_ONBOARDING_ENABLED: "TRUE",
    }),
    { enabled: false },
  );
  const env = {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_ONBOARDING_ENABLED: "true",
    OPERATIONS_PORTAL_ORIGIN: "https://example.test",
    OPERATIONS_RESEND_API_KEY: "re_synthetic",
    OPERATIONS_ONBOARDING_INVITE_KEY: Buffer.alloc(32, 8).toString("base64"),
  };
  const config = readOnboardingConfiguration(env);
  assert.equal(config.enabled, true);
  for (const origin of [
    "http://example.test",
    "https://user@example.test",
    "https://example.test/path",
    "https://example.test/?q=1",
    "https://example.test/#x",
  ])
    assert.throws(() =>
      readOnboardingConfiguration({ ...env, OPERATIONS_PORTAL_ORIGIN: origin }),
    );
  assert.throws(() =>
    readOnboardingConfiguration({
      ...env,
      OPERATIONS_RESEND_API_KEY: undefined,
    }),
  );
  assert.throws(() =>
    readOnboardingConfiguration({
      ...env,
      OPERATIONS_ONBOARDING_INVITE_KEY: undefined,
    }),
  );
});
