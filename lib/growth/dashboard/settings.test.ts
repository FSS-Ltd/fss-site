import assert from "node:assert/strict";
import test from "node:test";

import { buildSettingsView, computeNextCronRun } from "./settings";

const now = new Date("2026-08-21T10:03:00.000Z");

function baseInput() {
  return {
    now,
    databaseAvailable: true,
    automationsEnabled: true,
    codexConfigured: true,
    gmailConfigured: true,
    gmailConnection: null,
    ownerEmail: "founder@example.test",
    resendConfigured: true,
    resendFromEmail: "hello@example.test",
    resendReplyToEmail: "founder@example.test",
    vercelBlobConfigured: true,
    activeSequenceCount: 4,
  };
}

test("computeNextCronRun rounds up to the next N-minute boundary", () => {
  assert.equal(
    computeNextCronRun("*/5 * * * *", new Date("2026-08-21T10:03:00.000Z"))?.toISOString(),
    "2026-08-21T10:05:00.000Z",
  );
  assert.equal(
    computeNextCronRun("*/10 * * * *", new Date("2026-08-21T10:00:00.000Z"))?.toISOString(),
    "2026-08-21T10:10:00.000Z",
  );
  assert.equal(
    computeNextCronRun("*/5 * * * *", new Date("2026-08-21T10:59:30.000Z"))?.toISOString(),
    "2026-08-21T11:00:00.000Z",
  );
});

test("computeNextCronRun returns null for a schedule shape it does not support", () => {
  assert.equal(computeNextCronRun("0 9 * * 1-5", now), null);
});

test("buildSettingsView reports Gmail as disconnected with no account identity when never connected", () => {
  const data = buildSettingsView(baseInput());
  assert.deepEqual(data.gmail, {
    configured: true,
    status: "disconnected",
    accountIdentity: null,
    grantedScopes: [],
    lastSuccessAt: null,
    lastErrorCode: null,
  });
});

test("buildSettingsView surfaces the founder's own identity, scopes, and last success once connected", () => {
  const data = buildSettingsView({
    ...baseInput(),
    gmailConnection: {
      status: "connected",
      grantedScopes: ["gmail.send", "gmail.readonly"],
      lastSyncedAt: new Date("2026-08-21T09:50:00.000Z"),
      lastErrorCode: null,
    },
  });
  assert.equal(data.gmail.status, "connected");
  assert.equal(data.gmail.accountIdentity, "founder@example.test");
  assert.deepEqual(data.gmail.grantedScopes, ["gmail.send", "gmail.readonly"]);
  assert.equal(data.gmail.lastSuccessAt, "2026-08-21T09:50:00.000Z");
});

test("buildSettingsView clears the account identity once Gmail is revoked, but keeps the last error category", () => {
  const data = buildSettingsView({
    ...baseInput(),
    gmailConnection: {
      status: "revoked",
      grantedScopes: [],
      lastSyncedAt: null,
      lastErrorCode: "provider_revocation_unconfirmed",
    },
  });
  assert.equal(data.gmail.accountIdentity, null);
  assert.equal(data.gmail.lastErrorCode, "provider_revocation_unconfirmed");
});

test("buildSettingsView reports Resend as not configured when any required env var is missing", () => {
  const data = buildSettingsView({
    ...baseInput(),
    resendConfigured: false,
    resendFromEmail: null,
    resendReplyToEmail: null,
  });
  assert.deepEqual(data.resend, {
    configured: false,
    fromEmail: null,
    replyToEmail: null,
  });
});

test("buildSettingsView only exposes the redacted fields — no secrets, tokens, or raw provider errors have a slot to leak through", () => {
  const data = buildSettingsView({
    ...baseInput(),
    gmailConnection: {
      status: "connected",
      grantedScopes: ["gmail.send"],
      lastSyncedAt: now,
      lastErrorCode: null,
    },
  });

  assert.deepEqual(Object.keys(data.gmail).sort(), [
    "accountIdentity",
    "configured",
    "grantedScopes",
    "lastErrorCode",
    "lastSuccessAt",
    "status",
  ]);
  assert.deepEqual(Object.keys(data.resend).sort(), [
    "configured",
    "fromEmail",
    "replyToEmail",
  ]);
  assert.deepEqual(Object.keys(data).sort(), [
    "automation",
    "checkedAt",
    "codexConfigured",
    "databaseAvailable",
    "gmail",
    "resend",
    "vercelBlobConfigured",
  ]);
});

test("buildSettingsView passes through Vercel Blob configuration", () => {
  const configured = buildSettingsView({ ...baseInput(), vercelBlobConfigured: true });
  assert.equal(configured.vercelBlobConfigured, true);

  const notConfigured = buildSettingsView({
    ...baseInput(),
    vercelBlobConfigured: false,
  });
  assert.equal(notConfigured.vercelBlobConfigured, false);
});

test("buildSettingsView reports whether signed research ingestion is configured", () => {
  assert.equal(buildSettingsView(baseInput()).codexConfigured, true);
  assert.equal(
    buildSettingsView({ ...baseInput(), codexConfigured: false }).codexConfigured,
    false,
  );
});

test("buildSettingsView lists all four cron jobs with a label when automations are enabled", () => {
  const data = buildSettingsView(baseInput());
  assert.equal(data.automation.crons.length, 4);
  for (const cron of data.automation.crons) {
    assert.ok(cron.label.length > 0);
  }
});

test("buildSettingsView computes a next run for the minute-interval crons but not the daily maintenance cron", () => {
  const data = buildSettingsView(baseInput());
  for (const cron of data.automation.crons) {
    if (cron.path === "/api/cron/maintenance") {
      assert.equal(cron.nextRunAt, null);
    } else {
      assert.notEqual(cron.nextRunAt, null);
    }
  }
});

test("buildSettingsView reports no next run for any cron once automations are disabled", () => {
  const data = buildSettingsView({ ...baseInput(), automationsEnabled: false });
  for (const cron of data.automation.crons) {
    assert.equal(cron.nextRunAt, null);
  }
});

test("buildSettingsView passes through the active sequence count and database availability", () => {
  const data = buildSettingsView({
    ...baseInput(),
    databaseAvailable: false,
    activeSequenceCount: 7,
  });
  assert.equal(data.databaseAvailable, false);
  assert.equal(data.automation.activeSequenceCount, 7);
});
