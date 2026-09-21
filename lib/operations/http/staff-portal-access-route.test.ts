import assert from "node:assert/strict";
import test from "node:test";
import { createStaffPortalAccessRouteHandler } from "./staff-portal-access-route";

const origin = "https://portal.example.test";

test("rejects a forged origin before executing a Studio portal-access command", async () => {
  let called = false;
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      called = true;
      return { status: "sent" as const };
    },
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request("https://portal.example.test/api/portal/admin/portal-access", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", origin: "https://evil.example.test" },
      method: "POST",
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("returns only a narrow provider-safe invitation outcome", async () => {
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => ({ status: "sent" }),
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request("https://portal.example.test/api/portal/admin/portal-access", {
      body: JSON.stringify({ action: "invite_existing_client" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    }),
  );
  assert.deepEqual(await response.json(), { status: "sent" });
});
