import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  isSuppressed,
  recordComplaint,
  recordHardBounce,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type EmailSuppressionDependencies,
  type SuppressibleStatus,
} from "./suppression";

const SECRET = "a".repeat(32);

function createHarness(seed: Record<string, SuppressibleStatus> = {}) {
  const store = new Map(Object.entries(seed));
  const upsertCalls: { normalisedEmail: string; status: string; occurredAt: Date }[] = [];

  const dependencies: EmailSuppressionDependencies = {
    findSubscriberStatusByEmail: async (normalisedEmail) => {
      const status = store.get(normalisedEmail);
      return status ? { status } : null;
    },
    upsertSuppressedStatus: async (normalisedEmail, status, occurredAt) => {
      store.set(normalisedEmail, status);
      upsertCalls.push({ normalisedEmail, status, occurredAt });
    },
  };

  return { dependencies, store, upsertCalls };
}

test("an address with no record is not suppressed", async () => {
  const { dependencies } = createHarness();
  assert.equal(await isSuppressed("nobody@example.test", dependencies), false);
});

test("a pending or subscribed address is not suppressed", async () => {
  const { dependencies } = createHarness({
    "pending@example.test": "pending",
    "subscribed@example.test": "subscribed",
  });
  assert.equal(await isSuppressed("pending@example.test", dependencies), false);
  assert.equal(await isSuppressed("subscribed@example.test", dependencies), false);
});

test("unsubscribed, bounced, and complained addresses are suppressed", async () => {
  const { dependencies } = createHarness({
    "unsubscribed@example.test": "unsubscribed",
    "bounced@example.test": "bounced",
    "complained@example.test": "complained",
  });
  assert.equal(await isSuppressed("unsubscribed@example.test", dependencies), true);
  assert.equal(await isSuppressed("bounced@example.test", dependencies), true);
  assert.equal(await isSuppressed("complained@example.test", dependencies), true);
});

test("suppression checks are case-insensitive", async () => {
  const { dependencies } = createHarness({ "ada@example.test": "bounced" });
  assert.equal(await isSuppressed("Ada@Example.Test", dependencies), true);
});

test("recordHardBounce and recordComplaint upsert the suppressed status", async () => {
  const { dependencies, upsertCalls } = createHarness();
  await recordHardBounce("Ada@Example.test", dependencies, new Date("2026-01-01T00:00:00Z"));
  await recordComplaint("bob@example.test", dependencies, new Date("2026-01-02T00:00:00Z"));

  assert.deepEqual(upsertCalls, [
    { normalisedEmail: "ada@example.test", status: "bounced", occurredAt: new Date("2026-01-01T00:00:00Z") },
    { normalisedEmail: "bob@example.test", status: "complained", occurredAt: new Date("2026-01-02T00:00:00Z") },
  ]);
  assert.equal(await isSuppressed("ada@example.test", dependencies), true);
});

test("a valid signed token verifies to the normalised email", () => {
  const token = signUnsubscribeToken("Ada@Example.test", SECRET, new Date("2026-01-01T00:00:00Z"));
  const result = verifyUnsubscribeToken(token, SECRET, new Date("2026-01-02T00:00:00Z"));

  assert.deepEqual(result, { ok: true, normalisedEmail: "ada@example.test" });
});

test("a token verified with the wrong secret is rejected", () => {
  const token = signUnsubscribeToken("ada@example.test", SECRET);
  const result = verifyUnsubscribeToken(token, "b".repeat(32));

  assert.deepEqual(result, { ok: false, reason: "invalid_signature" });
});

test("an altered payload is rejected even with a correct-looking signature", () => {
  const token = signUnsubscribeToken("ada@example.test", SECRET);
  const [payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({ purpose: "newsletter-unsubscribe", email: "someone-else@example.test", exp: 9999999999 }),
    "utf8",
  ).toString("base64url");
  const tampered = `${tamperedPayload}.${signature}`;

  assert.equal(payload === tamperedPayload, false);
  const result = verifyUnsubscribeToken(tampered, SECRET);
  assert.deepEqual(result, { ok: false, reason: "invalid_signature" });
});

test("an expired token is rejected", () => {
  const token = signUnsubscribeToken("ada@example.test", SECRET, new Date("2026-01-01T00:00:00Z"));
  const farFuture = new Date("2027-01-01T00:00:00Z");

  const result = verifyUnsubscribeToken(token, SECRET, farFuture);
  assert.deepEqual(result, { ok: false, reason: "expired" });
});

test("a malformed token is rejected", () => {
  assert.deepEqual(verifyUnsubscribeToken("not-a-real-token", SECRET), {
    ok: false,
    reason: "malformed",
  });
  assert.deepEqual(verifyUnsubscribeToken("", SECRET), { ok: false, reason: "malformed" });
});

test("a validly-signed token for a different purpose is rejected", () => {
  // Simulates the secret being reused by some other signed-token feature:
  // even a genuine, correctly-signed token is rejected if its purpose claim
  // does not match, so a token never becomes valid outside the context it
  // was issued for.
  const encodedPayload = Buffer.from(
    JSON.stringify({ purpose: "some-other-purpose", email: "ada@example.test", exp: 9999999999 }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(encodedPayload).digest("base64url");
  const crossPurposeToken = `${encodedPayload}.${signature}`;

  assert.deepEqual(verifyUnsubscribeToken(crossPurposeToken, SECRET), {
    ok: false,
    reason: "malformed",
  });
});
