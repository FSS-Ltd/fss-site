import assert from "node:assert/strict";
import test from "node:test";
import { createPortalLogoutHandler } from "./logout-handler";
const origin = "https://portal.example.test";
test("logout rejects cross-origin submission and redirects only to canonical login", async () => {
  let signs = 0;
  let clears = 0;
  const handler = createPortalLogoutHandler({
    enabled: true,
    configured: true,
    origin,
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => {},
    signOut: async () => {
      signs++;
    },
    clearPendingInvite: async () => {
      clears++;
    },
  });
  const rejected = await handler(
    new Request(`${origin}/portal/auth/logout`, {
      method: "POST",
      headers: { origin: "https://evil.test" },
    }),
  );
  assert.equal(rejected.status, 403);
  assert.equal(signs, 0);
  const response = await handler(
    new Request(`${origin}/portal/auth/logout?next=https://evil.test`, {
      method: "POST",
      headers: { origin },
    }),
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${origin}/portal/login`);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(signs, 1);
  assert.equal(clears, 1);
});

test("logout reports provider failure without exposing its details", async () => {
  const handler = createPortalLogoutHandler({
    enabled: true,
    configured: true,
    origin,
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => {},
    signOut: async () => {
      throw new Error("provider-secret");
    },
    clearPendingInvite: async () => {},
  });
  const response = await handler(
    new Request(`${origin}/portal/auth/logout`, {
      method: "POST",
      headers: { origin },
    }),
  );
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /provider-secret/);
});
