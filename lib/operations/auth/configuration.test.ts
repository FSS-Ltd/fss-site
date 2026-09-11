import assert from "node:assert/strict";
import test from "node:test";
import { readPortalAuthConfig } from "./configuration";
test("portal auth configuration requires dedicated Clerk keys", () => {
  const env = {
    OPERATIONS_ENABLED: "true",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
    CLERK_SECRET_KEY: "sk_test_fixture",
    OPERATIONS_PORTAL_DATABASE_URL: "postgres://fixture",
  };
  assert.equal(readPortalAuthConfig(env).publishableKey, "pk_test_fixture");
  for (const changes of [
    { OPERATIONS_ENABLED: "false" },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "sk_test_fixture" },
    { CLERK_SECRET_KEY: "pk_test_fixture" },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined },
    { CLERK_SECRET_KEY: undefined },
  ])
    assert.throws(() => readPortalAuthConfig({ ...env, ...changes }));
});
