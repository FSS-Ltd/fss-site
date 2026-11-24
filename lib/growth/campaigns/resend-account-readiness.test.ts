import assert from "node:assert/strict";
import test from "node:test";
import { assessResendAccountReadiness } from "./resend-account-readiness";

const now = new Date("2026-11-23T12:00:00Z");
const binding = {
  team: "team-1",
  environment: "production" as const,
  sender: "outreach@example.test",
  domain: "example.test",
  replyTo: "owner@example.test",
  sendGeneration: "22222222-2222-4222-8222-222222222222",
  usageGeneration: "33333333-3333-4333-8333-333333333333",
};
const health = {
  source: "founder review",
  observedFrom: new Date(now.getTime() - 10000),
  observedUntil: new Date(now.getTime() - 1000),
  expiresAt: new Date(now.getTime() + 100000),
  complete: true,
  verdict: "healthy" as const,
  sends: 100,
  attempts: 101,
  hardBounces: 0,
  complaints: 0,
  rateIncidents: 0,
  authIncidents: 0,
  authentication: {
    spf: { status: "pass" as const, source: "review" },
    dkim: { status: "pass" as const, source: "review" },
    dmarc: { status: "pass" as const, source: "review" },
  },
};
const usage = {
  observedAt: new Date(now.getTime() - 1000).toISOString(),
  validUntil: new Date(now.getTime() + 60000).toISOString(),
  daily: {
    used: 10,
    sent: 8,
    received: 2,
    limit: 100,
    resets_at: new Date(now.getTime() + 86400000).toISOString(),
  },
  monthly: {
    used: 50,
    sent: 40,
    received: 10,
    limit: null,
    resets_at: new Date(now.getTime() + 864000000).toISOString(),
  },
  rateLimit: { limit: 10, duration: "1000ms" },
};
const snapshot = {
  binding,
  runtimeBinding: binding,
  state: "active",
  health,
  usage,
  usageGeneration: binding.usageGeneration,
  sendCredential: "send-key",
  usageCredential: "usage-key",
  monitoredMailbox: true,
};

test("requires a current bound usage observation and reviewed health", () => {
  assert.equal(assessResendAccountReadiness(snapshot, now).status, "ready");
  assert.equal(
    assessResendAccountReadiness(
      {
        ...snapshot,
        runtimeBinding: {
          ...binding,
          sendGeneration: "44444444-4444-4444-8444-444444444444",
        },
      },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness(
      { ...snapshot, usageGeneration: "44444444-4444-4444-8444-444444444444" },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness({ ...snapshot, usageCredential: "" }, now)
      .status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness({ ...snapshot, monitoredMailbox: false }, now)
      .status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness(
      { ...snapshot, usage: { ...usage, validUntil: now.toISOString() } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness(
      { ...snapshot, health: { ...health, complaints: 1 } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessResendAccountReadiness(
      {
        ...snapshot,
        usage: { ...usage, daily: { ...usage.daily, used: 100, sent: 98 } },
      },
      now,
    ).status,
    "held",
  );
});
