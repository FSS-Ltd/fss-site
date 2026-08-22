import assert from "node:assert/strict";
import test from "node:test";

import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

import { createMaintenanceRouteHandler } from "./route";

const CRON_SECRET = "cron-secret-value";

const HEALTHY_REPORT: readonly IntegrationHealth[] = [
  {
    provider: "gmail",
    status: "healthy",
    checkedAt: "2026-08-22T03:17:00.000Z",
    message: "Gmail connected",
  },
];

function request(headers: Record<string, string> = {}): Request {
  return new Request(
    "https://faithfulsoftwaresolutions.co.uk/api/cron/maintenance",
    { headers },
  );
}

test("rejects a request with no authorization header", async () => {
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    buildReport: async () => ({ integrations: HEALTHY_REPORT }),
  });

  const response = await handler(request());

  assert.equal(response.status, 401);
});

test("rejects a request with the wrong secret", async () => {
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    buildReport: async () => ({ integrations: HEALTHY_REPORT }),
  });

  const response = await handler(
    request({ authorization: "Bearer wrong-secret" }),
  );

  assert.equal(response.status, 401);
});

test("no-ops without building a report when automations are disabled", async () => {
  let buildReportCalls = 0;
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: false,
    buildReport: async () => {
      buildReportCalls += 1;
      return { integrations: HEALTHY_REPORT };
    },
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.skipped, "automations_disabled");
  assert.equal(buildReportCalls, 0);
});

test("returns the redacted integration report when authorized and enabled", async () => {
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    buildReport: async () => ({ integrations: HEALTHY_REPORT }),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.report, { integrations: HEALTHY_REPORT });
});

test("never includes a secret, token, or provider payload in the report body", async () => {
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    buildReport: async () => ({ integrations: HEALTHY_REPORT }),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );
  const bodyText = await response.text();

  for (const forbidden of [CRON_SECRET, "token", "refreshToken", "secret"]) {
    assert.equal(
      bodyText.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `response body must not include "${forbidden}"`,
    );
  }
});

test("reports a 500 and calls the error reporter when the report build throws", async () => {
  const reported: unknown[] = [];
  const handler = createMaintenanceRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    buildReport: async () => {
      throw new Error("boom");
    },
    reportUnexpectedError: (error) => reported.push(error),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 500);
  assert.equal(reported.length, 1);
});
