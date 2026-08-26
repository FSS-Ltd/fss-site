import assert from "node:assert/strict";
import test from "node:test";

import type { IntegrationConnectionHealth } from "../db/repositories/integration-connections";
import { buildIntegrationHealthSummary } from "./integration-health";

const checkedAt = new Date("2026-08-17T06:00:00.000Z");

test("builds a fixed five-provider summary from connection and configuration state", () => {
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
    codexConfigured: true,
    connections: rows,
    databaseAvailable: true,
    resendConfigured: true,
  });

  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map(({ provider, status }) => ({ provider, status })),
    [
      { provider: "database", status: "healthy" },
      { provider: "gmail", status: "healthy" },
      { provider: "resend", status: "healthy" },
      { provider: "codex", status: "healthy" },
      { provider: "cron", status: "disabled" },
    ],
  );
});

test("reports a safe degraded summary when the database is unavailable", () => {
  const result = buildIntegrationHealthSummary({
    automationsEnabled: true,
    checkedAt,
    codexConfigured: false,
    connections: [],
    databaseAvailable: false,
    resendConfigured: false,
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
      status: "disabled",
      checkedAt: checkedAt.toISOString(),
      message: "Resend not configured",
    },
    {
      provider: "codex",
      status: "disabled",
      checkedAt: checkedAt.toISOString(),
      message: "Signed research ingestion not configured",
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

test("reports signed research ingestion as configured without implying the external task is active", () => {
  const result = buildIntegrationHealthSummary({
    automationsEnabled: false,
    checkedAt,
    codexConfigured: true,
    connections: [],
    databaseAvailable: true,
    resendConfigured: false,
  });

  assert.deepEqual(result.find(({ provider }) => provider === "codex"), {
    provider: "codex",
    status: "healthy",
    checkedAt: checkedAt.toISOString(),
    message: "Signed research ingestion configured",
  });
});

test("reports Resend as configured without requiring an OAuth connection row", () => {
  const result = buildIntegrationHealthSummary({
    automationsEnabled: false,
    checkedAt,
    codexConfigured: true,
    connections: [],
    databaseAvailable: true,
    resendConfigured: true,
  });

  assert.deepEqual(result.find(({ provider }) => provider === "resend"), {
    provider: "resend",
    status: "healthy",
    checkedAt: checkedAt.toISOString(),
    message: "Resend configured",
  });
});
