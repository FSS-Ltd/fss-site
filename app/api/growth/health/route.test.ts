import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "@/lib/growth/auth/require-founder";
import type { GrowthReleaseHealth } from "@/lib/growth/health/checks";

import { createHealthRouteHandler } from "./route";

const HEALTHY_REPORT: GrowthReleaseHealth = {
  checkedAt: "2026-08-22T12:00:00.000Z",
  application: { status: "healthy", reasons: [] },
  dependencies: {
    status: "ready",
    gmail: "configured",
    resend: "configured",
    blob: "configured",
    codex: "configured",
    migrations: "unknown",
    reasons: [],
  },
  automation: { status: "disabled", reasons: [] },
};

function request(): Request {
  return new Request(
    "https://faithfulsoftwaresolutions.co.uk/api/growth/health",
  );
}

test("rejects a request without a founder session", async () => {
  const handler = createHealthRouteHandler({
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    buildReport: async () => HEALTHY_REPORT,
  });

  const response = await handler(request());

  assert.equal(response.status, 401);
});

test("returns the health report for an authorized founder", async () => {
  const handler = createHealthRouteHandler({
    authorizeFounder: async () => ({ email: "founder@example.test", actorId: "a" }),
    buildReport: async () => HEALTHY_REPORT,
  });

  const response = await handler(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.report, HEALTHY_REPORT);
});

test("responds with cache-control: no-store", async () => {
  const handler = createHealthRouteHandler({
    authorizeFounder: async () => ({ email: "founder@example.test", actorId: "a" }),
    buildReport: async () => HEALTHY_REPORT,
  });

  const response = await handler(request());

  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("reports a 500 and calls the error reporter when the report build throws", async () => {
  const reported: unknown[] = [];
  const handler = createHealthRouteHandler({
    authorizeFounder: async () => ({ email: "founder@example.test", actorId: "a" }),
    buildReport: async () => {
      throw new Error("boom");
    },
    reportUnexpectedError: (error) => reported.push(error),
  });

  const response = await handler(request());

  assert.equal(response.status, 500);
  assert.equal(reported.length, 1);
});

test("propagates an unexpected authorization error instead of masking it as unauthorized", async () => {
  const handler = createHealthRouteHandler({
    authorizeFounder: async () => {
      throw new Error("database exploded");
    },
    buildReport: async () => HEALTHY_REPORT,
  });

  await assert.rejects(() => handler(request()), /database exploded/);
});
