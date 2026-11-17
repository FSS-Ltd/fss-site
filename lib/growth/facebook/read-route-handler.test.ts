import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createFacebookReadHandler } from "./read-route-handler";
import type { FacebookWorkspaceResult } from "./workspace";

const origin = "https://faithfulsoftware.dev";
const ready: FacebookWorkspaceResult = {
  status: "ready",
  destinations: [],
  nextCursor: null,
  historyLimit: 20,
  pilots: { total: 2, used: 0, remaining: 2, allocations: [] },
};
function handler(
  overrides: Partial<Parameters<typeof createFacebookReadHandler>[0]> = {},
) {
  return createFacebookReadHandler({
    db: {} as GrowthDb,
    origin,
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    read: async () => ready,
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}
test("accepts same-origin GET with or without Origin", async () => {
  for (const headers of [new Headers({ origin }), new Headers()])
    assert.equal(
      (
        await handler()(
          new Request(`${origin}/api/growth/facebook`, { headers }),
        )
      ).status,
      200,
    );
});
test("rejects foreign, malformed, host-mismatched and cross-site GETs", async () => {
  for (const request of [
    new Request(`${origin}/api/growth/facebook`, {
      headers: { origin: "https://foreign.example" },
    }),
    new Request(`${origin}/api/growth/facebook`, {
      headers: { origin: "invalid" },
    }),
    new Request("https://foreign.example/api/growth/facebook"),
    new Request(`${origin}/api/growth/facebook`, {
      headers: { "sec-fetch-site": "cross-site" },
    }),
  ])
    assert.equal((await handler()(request)).status, 400);
});
test("rejects unauthorized and invalid cursors, and returns reader errors", async () => {
  const request = new Request(`${origin}/api/growth/facebook`);
  assert.equal(
    (
      await handler({
        authorizeFounder: async () => {
          throw new FounderAuthorizationError();
        },
      })(request)
    ).status,
    401,
  );
  assert.equal(
    (await handler()(new Request(`${origin}/api/growth/facebook?cursor=bad`)))
      .status,
    422,
  );
  assert.equal(
    (
      await handler({
        read: async () => ({
          status: "error",
          message: "Unavailable",
          correlationId: "correlation",
        }),
      })(request)
    ).status,
    503,
  );
});
