import assert from "node:assert/strict";
import test from "node:test";

import { buildHealthReport, type HealthCheckInput } from "./checks";

function baseInput(): HealthCheckInput {
  return {
    now: new Date("2026-08-22T12:00:00.000Z"),
    databaseAvailable: true,
    migrationStatus: "current",
    automationsEnabled: false,
    gmailConfigured: true,
    gmailConnected: true,
    resendConfigured: true,
    blobConfigured: true,
    cronLastSyncedAt: new Date("2026-08-22T11:55:00.000Z"),
    cronStaleAfterMinutes: 30,
    codexLastRunAt: new Date("2026-08-21T09:00:00.000Z"),
    codexStaleAfterHours: 96,
  };
}

test("reports a healthy application with a healthy database and current migrations", () => {
  const report = buildHealthReport(baseInput());
  assert.equal(report.application.status, "healthy");
  assert.deepEqual(report.application.reasons, []);
});

test("reports an unavailable application when the database is unreachable", () => {
  const report = buildHealthReport({ ...baseInput(), databaseAvailable: false });
  assert.equal(report.application.status, "unavailable");
  assert.ok(report.application.reasons.includes("database_unavailable"));
});

test("reports an unavailable application on a migration mismatch", () => {
  const report = buildHealthReport({
    ...baseInput(),
    migrationStatus: "mismatched",
  });
  assert.equal(report.application.status, "unavailable");
  assert.ok(report.application.reasons.includes("migration_mismatch"));
});

test("reports dependencies as attention when Gmail is not configured", () => {
  const report = buildHealthReport({ ...baseInput(), gmailConfigured: false });
  assert.equal(report.dependencies.status, "attention");
  assert.equal(report.dependencies.gmail, "not_configured");
  assert.ok(report.dependencies.reasons.includes("gmail_not_configured"));
});

test("reports dependencies as attention when Resend is misconfigured", () => {
  const report = buildHealthReport({ ...baseInput(), resendConfigured: false });
  assert.equal(report.dependencies.status, "attention");
  assert.equal(report.dependencies.resend, "not_configured");
  assert.ok(report.dependencies.reasons.includes("resend_not_configured"));
});

test("reports dependencies as attention when Vercel Blob is missing", () => {
  const report = buildHealthReport({ ...baseInput(), blobConfigured: false });
  assert.equal(report.dependencies.status, "attention");
  assert.equal(report.dependencies.blob, "not_configured");
  assert.ok(report.dependencies.reasons.includes("blob_not_configured"));
});

test("reports automation as disabled when the automations flag is off, independent of application health", () => {
  const report = buildHealthReport(baseInput());
  assert.equal(report.application.status, "healthy");
  assert.equal(report.automation.status, "disabled");
});

test("reports automation as blocked when the cron heartbeat is stale", () => {
  const report = buildHealthReport({
    ...baseInput(),
    automationsEnabled: true,
    cronLastSyncedAt: new Date("2026-08-22T09:00:00.000Z"),
  });
  assert.equal(report.automation.status, "blocked");
  assert.ok(report.automation.reasons.includes("cron_stale"));
});

test("notes a stale Codex research run without blocking automation readiness", () => {
  const report = buildHealthReport({
    ...baseInput(),
    automationsEnabled: true,
    codexLastRunAt: new Date("2026-08-10T00:00:00.000Z"),
  });
  assert.equal(report.automation.status, "enabled");
  assert.ok(report.automation.reasons.includes("codex_stale"));
});

test("reports automation as enabled when every precondition is met", () => {
  const report = buildHealthReport({ ...baseInput(), automationsEnabled: true });
  assert.equal(report.automation.status, "enabled");
  assert.deepEqual(report.automation.reasons, []);
});

test("reports automation as blocked when a dependency is unready even with the flag on", () => {
  const report = buildHealthReport({
    ...baseInput(),
    automationsEnabled: true,
    gmailConnected: false,
  });
  assert.equal(report.automation.status, "blocked");
  assert.ok(report.automation.reasons.includes("gmail_disconnected"));
});

test("never includes a secret, token, database host, recipient address, or provider response body", () => {
  const report = buildHealthReport({ ...baseInput(), automationsEnabled: true });
  const serialised = JSON.stringify(report).toLowerCase();

  for (const forbidden of [
    "postgres://",
    "postgresql://",
    "@",
    "token",
    "secret",
    "password",
  ]) {
    assert.equal(
      serialised.includes(forbidden),
      false,
      `report must not include "${forbidden}"`,
    );
  }
});
