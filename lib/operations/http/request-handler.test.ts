import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { PortalAccessDenied } from "../auth/types";
import { RequestConflict } from "../requests/types";
import {
  createPortalRequestHandler,
  type PortalRequestDependencies,
} from "./request-handler";
const organisationId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const identity = {
  userId: organisationId,
  email: "synthetic@example.test",
  emailVerified: true as const,
};
function setup(overrides: Partial<PortalRequestDependencies> = {}) {
  const calls: string[] = [];
  const deps: PortalRequestDependencies = {
    enabled: true,
    configured: true,
    origin: "https://fss.test",
    createCorrelationId: () => organisationId,
    getIdentity: async () => identity,
    consumeRateLimit: async () => true,
    execute: async (_identity, organisation, command) => {
      calls.push(organisation);
      assert.deepEqual(command, {
        action: "comment",
        expectedVersion: 1,
        body: "Hello",
        requestId,
      });
      return { id: requestId, version: 2 };
    },
    reportUnexpectedError: () => {},
    ...overrides,
  };
  return { handler: createPortalRequestHandler(deps), calls };
}
function request(
  body: unknown = {
    organisationId,
    command: { action: "comment", expectedVersion: 1, body: "Hello" },
  },
  origin = "https://fss.test",
) {
  return new Request("https://fss.test/api/portal/requests", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("request handler passes only verified identity and route-selected ID, with private response", async () => {
  const { handler, calls } = setup();
  const response = await handler(request(), requestId);
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [organisationId]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    request: { id: requestId, version: 2 },
  });
});
for (const [name, overrides, status] of [
  ["disabled", { enabled: false }, 404],
  ["unconfigured", { configured: false }, 503],
  ["anonymous", { getIdentity: async () => null }, 401],
  ["limited", { consumeRateLimit: async () => false }, 429],
] as const)
  test(`request ${name} cannot reach mutation`, async () => {
    const { handler, calls } = setup(overrides);
    assert.equal((await handler(request(), requestId)).status, status);
    assert.deepEqual(calls, []);
  });
test("cross-origin, forged identity and duplicate route IDs are rejected before mutation", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(request(undefined, "https://evil.test"), requestId)).status,
    403,
  );
  assert.equal(
    (
      await handler(
        request({ organisationId, userId: identity.userId, command: {} }),
        requestId,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handler(
        request({ organisationId, command: { requestId } }),
        requestId,
      )
    ).status,
    400,
  );
  assert.deepEqual(calls, []);
});
test("conflicts and field errors stay actionable while provider errors remain private", async () => {
  for (const [error, status] of [
    [new RequestConflict(), 409],
    [new PortalAccessDenied(), 404],
    [new Error("secret database host"), 503],
  ] as const) {
    const { handler } = setup({
      execute: async () => {
        throw error;
      },
    });
    const response = await handler(request(), requestId);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /secret database host/);
  }
  const { handler } = setup({
    execute: async () => {
      z.object({ title: z.string().min(1) }).parse({ title: "" });
      return { id: requestId, version: 2 };
    },
  });
  const response = await handler(request(), requestId);
  assert.equal(response.status, 400);
  assert.ok((await response.json()).fields.title);
});
test("request body bounds and JSON media type are enforced", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        request({ organisationId, command: { body: "x".repeat(70000) } }),
        requestId,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await handler(
        new Request("https://fss.test/api/portal/requests", {
          method: "POST",
          headers: { origin: "https://fss.test" },
          body: "invalid",
        }),
        requestId,
      )
    ).status,
    415,
  );
  assert.deepEqual(calls, []);
});
