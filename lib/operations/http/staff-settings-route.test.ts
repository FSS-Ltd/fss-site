import assert from "node:assert/strict";
import test from "node:test";
import { createStaffSettingsRouteHandler } from "./staff-settings-route";

const origin = "https://portal.example.test";

test("returns only draft revision evidence after a Studio settings save", async () => {
  const handler = createStaffSettingsRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => ({ createdAt: "2026-09-21T10:00:00.000Z", revision: 3 }),
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(new Request("https://portal.example.test/api/portal/admin/settings", {
    body: JSON.stringify({ displayName: "FSS" }),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  }));
  assert.deepEqual(await response.json(), { createdAt: "2026-09-21T10:00:00.000Z", revision: 3 });
});
