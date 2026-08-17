import assert from "node:assert/strict";
import test from "node:test";

import type { IntegrationConnectionHealth } from "../db/repositories/integration-connections";
import { buildIntegrationHealthSummary } from "./integration-health";

const checkedAt = new Date("2026-08-17T06:00:00.000Z");

test("builds a fixed five-provider summary from safe connection rows", () => {
  const rows: readonly IntegrationConnectionHealth[] = [
    {
      provider: "gmail",
      status: "connected",
      lastSyncedAt: checkedAt,
    },
    {
      provider: "resend",
      status: "degraded",
      lastSyncedAt: null,
    },
  ];

  const result = buildIntegrationHealthSummary({
    automationsEnabled: false,
    checkedAt,
    connections: rows,
    databaseAvailable: true,
  });

  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "database", status: "healthy" },
      { provider: "gmail", status: "healthy" },
      { provider: "resend", status: "attention" },
      { provider: "codex", status: "disabled" },
      { provider: "cron", status: "disabled" },
    ],
  );
});

test("reports a safe degraded summary when the database is unavailable", () => {
  const result = buildIntegrationHealthSummary({
    automationsEnabled: true,
    checkedAt,
    connections: [],
    databaseAvailable: false,
  });

  assert.deepEqual(result, [
    {
      provider: "database",
      status: "attention",
      checkedAt: checkedAt.toISOString(),
      message: "Database needs attention",
    },
    {
      provider: "gmail",
      status: "attention",
      checkedAt: checkedAt.toISOString(),
      message: "Gmail status unavailable",
    },
    {
      provider: "resend",
      status: "attention",
      checkedAt: checkedAt.toISOString(),
      message: "Resend status unavailable",
    },
    {
      provider: "codex",
      status: "disabled",
      checkedAt: checkedAt.toISOString(),
      message: "Codex not configured",
    },
    {
      provider: "cron",
      status: "healthy",
      checkedAt: checkedAt.toISOString(),
      message: "Automations enabled",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /password|postgres|exception/i);
});
