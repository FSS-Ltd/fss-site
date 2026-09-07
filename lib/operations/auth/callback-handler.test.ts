import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortalCallbackHandler,
  type PortalCallbackDependencies,
} from "./callback-handler";
const origin = "https://portal.example.test";
const identity = {
  userId: "verified-user",
  email: "client@example.test",
  emailVerified: true,
} as const;
function fixture(overrides: Partial<PortalCallbackDependencies> = {}) {
  const codes: string[] = [];
  const claims: unknown[] = [];
  let clears = 0;
  return {
    codes,
    claims,
    cleared: () => clears,
    handler: createPortalCallbackHandler({
      enabled: true,
      configured: true,
      origin,
      createCorrelationId: () => "correlation",
      reportUnexpectedError: () => {},
      consumeRateLimit: async () => true,
      completeLogin: async (code) => {
        codes.push(code);
        return identity;
      },
      readPendingInvite: async () => "invitation",
      clearPendingInvite: async () => {
        clears++;
      },
      claimInvite: async (...args) => {
        claims.push(args);
      },
      ...overrides,
    }),
  };
}
const request = (query: string) =>
  new Request(`${origin}/portal/auth/callback${query}`);
test("callback requires exactly one bounded code and rejects redirect selectors", async () => {
  const f = fixture();
  for (const query of [
    "",
    "?code=",
    "?code=a&code=b",
    "?code=a&next=https://evil.test",
    `?code=${"a".repeat(2049)}`,
  ]) {
    const response = await f.handler(request(query));
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      `${origin}/portal/login?error=link`,
    );
  }
  assert.deepEqual(f.codes, []);
  assert.equal(f.cleared(), 5);
});
test("callback verifies identity before claiming and clears the one-time pending cookie", async () => {
  const f = fixture();
  const response = await f.handler(request("?code=valid-code"));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${origin}/portal`);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(f.claims, [[identity, "invitation", "correlation"]]);
  assert.equal(f.cleared(), 1);
});
test("wrong-email, replayed invitations, rate limits and invalid auth links have the same safe redirect", async () => {
  for (const overrides of [
    {
      claimInvite: async () => {
        throw new Error("wrong email");
      },
    },
    {
      claimInvite: async () => {
        throw new Error("replayed token");
      },
    },
    {
      completeLogin: async () => {
        throw new Error("expired code");
      },
    },
    { consumeRateLimit: async () => false },
  ]) {
    const f = fixture(overrides);
    const response = await f.handler(request("?code=valid-code"));
    assert.equal(
      response.headers.get("location"),
      `${origin}/portal/login?error=link`,
    );
    assert.equal(f.cleared(), 1);
  }
});

test("callback fails closed on disabled configuration and never claims without a pending invitation", async () => {
  assert.equal(
    (await fixture({ enabled: false }).handler(request("?code=valid"))).status,
    404,
  );
  assert.equal(
    (await fixture({ configured: false }).handler(request("?code=valid")))
      .status,
    503,
  );
  const f = fixture({ readPendingInvite: async () => null });
  assert.equal(
    (await f.handler(request("?code=valid"))).headers.get("location"),
    `${origin}/portal`,
  );
  assert.deepEqual(f.claims, []);
  const foreign = await f.handler(
    new Request("https://evil.test/portal/auth/callback?code=valid"),
  );
  assert.equal(
    foreign.headers.get("location"),
    `${origin}/portal/login?error=link`,
  );
});
