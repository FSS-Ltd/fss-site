import assert from "node:assert/strict";
import test from "node:test";
import { facebookDiscoveryBatchSchema, derivePostReadiness } from "./contracts";

const now = new Date("2026-11-17T12:00:00Z");
test("discovery accepts zero observations and rejects claimed authority", () => {
  const batch = {
    version: 1,
    purpose: "facebook_public_discovery" as const,
    externalRunId: "run-1",
    observedAt: now,
    observations: [],
  };
  assert.equal(
    facebookDiscoveryBatchSchema.parse(batch).observations.length,
    0,
  );
  assert.equal(
    facebookDiscoveryBatchSchema.safeParse({ ...batch, permission: "allowed" })
      .success,
    false,
  );
  assert.equal(
    facebookDiscoveryBatchSchema.safeParse({
      ...batch,
      observations: Array(11).fill({}),
    }).success,
    false,
  );
});
test("readiness expires and later contradictory evidence requires review", () => {
  const review = {
    decision: "allowed" as const,
    observedAt: new Date("2026-11-16"),
    expiresAt: new Date("2026-11-18"),
  };
  assert.equal(derivePostReadiness(review, null, now), "allowed");
  assert.equal(
    derivePostReadiness(review, new Date("2026-11-17"), now),
    "stale",
  );
  assert.equal(
    derivePostReadiness(review, null, new Date("2026-11-18")),
    "stale",
  );
  assert.equal(derivePostReadiness(null, null, now), "unknown");
});
