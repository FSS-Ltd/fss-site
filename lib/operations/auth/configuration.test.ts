import assert from "node:assert/strict";
import test from "node:test";
import { readPortalAuthConfig, portalCookieOptions } from "./configuration";
test("portal auth configuration never falls back to founder or privileged keys", () => {
  const env = {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_SUPABASE_URL: "https://auth.example.test",
    OPERATIONS_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    OPERATIONS_PORTAL_DATABASE_URL: "postgres://fixture",
  };
  assert.equal(readPortalAuthConfig(env).url, "https://auth.example.test");
  for (const changes of [
    { OPERATIONS_ENABLED: "false" },
    { OPERATIONS_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" },
    { OPERATIONS_SUPABASE_URL: "http://auth.example.test" },
    { OPERATIONS_SUPABASE_URL: "https://user:password@auth.example.test" },
    { OPERATIONS_SUPABASE_URL: "https://auth.example.test/auth/v1" },
  ])
    assert.throws(() => readPortalAuthConfig({ ...env, ...changes }));
  assert.throws(() =>
    readPortalAuthConfig({
      OPERATIONS_ENABLED: "true",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    }),
  );
  assert.equal(
    readPortalAuthConfig({
      ...env,
      OPERATIONS_SUPABASE_URL: "http://127.0.0.1:55521",
      NODE_ENV: "development",
    }).url,
    "http://127.0.0.1:55521",
  );
  assert.throws(() =>
    readPortalAuthConfig({
      ...env,
      OPERATIONS_SUPABASE_URL: "http://127.0.0.1:55521",
      NODE_ENV: "production",
    }),
  );
  assert.deepEqual(portalCookieOptions("https://portal.example.test"), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
});
