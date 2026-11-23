import assert from "node:assert/strict";
import test from "node:test";
import { readResendUsage } from "./usage";

const now = Date.parse("2026-11-23T10:00:00.000Z");
const payload = () => ({
  object: "usage",
  emails: {
    daily: {
      used: 10,
      sent: 8,
      received: 2,
      limit: 100,
      resets_at: "2026-11-24T00:00:00.000Z",
    },
    monthly: {
      used: 100,
      sent: 80,
      received: 20,
      limit: null,
      resets_at: "2026-12-01T00:00:00.000Z",
    },
  },
  rate_limit: { limit: 100, duration: "1000ms" },
});

test("reads one bounded account usage observation with the provider totals", async () => {
  let calls = 0;
  const result = await readResendUsage("test-key", {
    now: () => now,
    request: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.resend.com/usage");
      assert.equal(init?.redirect, "error");
      return Response.json(payload());
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "observed");
  if (result.status === "observed") {
    assert.equal(result.usage.daily.used, 10);
    assert.equal(result.usage.monthly.limit, null);
    assert.equal(result.usage.validUntil, "2026-11-23T10:05:00.000Z");
  }
});

test("holds incomplete, inconsistent, expired and oversized responses", async () => {
  const samples: unknown[] = [
    { ...payload(), rate_limit: { limit: 0, duration: "0ms" } },
    {
      ...payload(),
      emails: {
        ...payload().emails,
        daily: { ...payload().emails.daily, used: 9 },
      },
    },
    {
      ...payload(),
      emails: {
        ...payload().emails,
        daily: {
          ...payload().emails.daily,
          resets_at: "2026-11-23T09:59:00.000Z",
        },
      },
    },
    { ...payload(), emails: { ...payload().emails, monthly: null } },
  ];
  for (const sample of samples) {
    const result = await readResendUsage("test-key", {
      now: () => now,
      request: async () => Response.json(sample),
    });
    assert.equal(result.status, "held");
  }
  const oversized = await readResendUsage("test-key", {
    now: () => now,
    request: async () => new Response("x".repeat(262145)),
  });
  assert.equal(oversized.status, "held");
});

test("holds when response crosses freshness or reset bounds", async () => {
  let time = now;
  const result = await readResendUsage("test-key", {
    now: () => time,
    request: async () => {
      time += 301_000;
      return Response.json(payload());
    },
  });
  assert.equal(result.status, "held");
});
