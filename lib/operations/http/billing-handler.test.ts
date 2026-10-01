import assert from "node:assert/strict";
import test from "node:test";
import { PortalAccessDenied } from "../auth/types";
import {
  createPortalBillingHandler,
  type PortalBillingDependencies,
} from "./billing-handler";
const organisationId = "10000000-0000-4000-8000-000000000001";
const identity = {
  userId: organisationId,
  email: "synthetic@example.test",
  emailVerified: true as const,
};
function setup(overrides: Partial<PortalBillingDependencies> = {}) {
  const calls: unknown[] = [];
  const handler = createPortalBillingHandler({
    enabled: true,
    configured: true,
    origin: "https://fss.test",
    createCorrelationId: () => organisationId,
    getIdentity: async () => identity,
    consumeRateLimit: async () => true,
    execute: async (verified, command) => {
      calls.push([verified, command]);
      return "https://billing.stripe.com/p/session/synthetic";
    },
    reportUnexpectedError: () => {},
    ...overrides,
  });
  return { handler, calls };
}
function request(
  body: unknown = { organisationId, action: "manage" },
  headers: Record<string, string> = {},
) {
  return new Request("https://fss.test/api/portal/billing/session", {
    method: "POST",
    headers: {
      origin: "https://fss.test",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
test("billing handler passes verified identity and no-store hosted response", async () => {
  const { handler, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(calls, [[identity, { organisationId, action: "manage" }]]);
});
for (const [label, overrides, status] of [
  ["disabled", { enabled: false }, 404],
  ["unconfigured", { configured: false }, 503],
  ["anonymous", { getIdentity: async () => null }, 401],
  ["limited", { consumeRateLimit: async () => false }, 429],
] as const)
  test(`billing ${label} cannot reach provider command`, async () => {
    const { handler, calls } = setup(overrides);
    assert.equal((await handler(request())).status, status);
    assert.deepEqual(calls, []);
  });
test("billing rejects cross-origin requests, browser amounts, provider refs and return URLs", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request(undefined, { origin: "https://evil.test" }))).status,
    403,
  );
  assert.equal(
    (await handler(request(undefined, { "content-type": "text/plain" })))
      .status,
    415,
  );
  for (const field of ["amount", "customerId", "returnUrl", "userId"]) {
    assert.equal(
      (
        await handler(
          request({ organisationId, action: "manage", [field]: "forged" }),
        )
      ).status,
      400,
    );
  }
  assert.deepEqual(calls, []);
});
test("invoice command requires an internal invoice UUID", async () => {
  const { handler } = setup();
  assert.equal(
    (
      await handler(
        request({
          organisationId,
          action: "invoice",
          invoiceId: organisationId,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handler(
        request({
          organisationId,
          action: "invoice",
          invoiceId: "in_provider",
        }),
      )
    ).status,
    400,
  );
});
test("revoked or other-tenant access is concealed and unexpected errors are redacted", async () => {
  assert.equal(
    (
      await setup({
        execute: async () => {
          throw new PortalAccessDenied();
        },
      }).handler(request())
    ).status,
    404,
  );
  let report: unknown;
  const response = await setup({
    execute: async () => {
      throw new Error("sensitive provider response");
    },
    reportUnexpectedError: (value) => {
      report = value;
    },
  }).handler(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sensitive/);
  assert.deepEqual(report, {
    correlationId: organisationId,
    errorName: "Error",
  });
});
test("oversized and malformed JSON are rejected", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request({ padding: "x".repeat(1200) }))).status,
    413,
  );
  assert.equal(
    (
      await handler(
        new Request("https://fss.test/api/portal/billing/session", {
          method: "POST",
          headers: {
            origin: "https://fss.test",
            "content-type": "application/json",
          },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.deepEqual(calls, []);
});

test("management accepts supported explicit currency and rejects unsupported currency", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        request({ organisationId, action: "manage", currency: "USD" }),
      )
    ).status,
    200,
  );
  assert.deepEqual(calls[0], [
    identity,
    { organisationId, action: "manage", currency: "USD" },
  ]);
  assert.equal(
    (
      await handler(
        request({ organisationId, action: "manage", currency: "JPY" }),
      )
    ).status,
    400,
  );
});
