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

test("all Facebook timestamps require explicit valid timestamps and nested source keeps its refinements", async () => {
  const { facebookCommandSchema } = await import("./contracts");
  const requestId = "e1f96e68-5ab6-45ff-b043-51b5fe70af90";
  const source = {
    requestId,
    sourceType: "facebook_page",
    sourceUrl: "https://facebook.com/example",
    businessName: "Acme",
    countryCode: "GB",
    corporateType: null,
    registrationNumber: null,
    firstName: null,
    lastName: null,
    email: null,
    opportunity: "Review",
    offer: "Website",
    observedAt: now,
  };
  const destination = {
    url: "https://facebook.com/example",
    name: "Example",
    kind: "page",
    locality: null,
    websiteUrl: null,
    observation: {
      sourceUrl: "https://facebook.com/example",
      summary: "Public",
      observedAt: now,
    },
  };
  for (const bad of [
    null,
    false,
    0,
    "0",
    "2026-11-17",
    "2026-11-17T12:00:00",
    "2026-02-30T12:00:00Z",
  ]) {
    assert.equal(
      facebookCommandSchema.safeParse({
        type: "record_activity",
        requestId,
        destinationId: requestId,
        activity: "posted",
        occurredAt: bad,
        evidenceUrl: null,
        prospectId: null,
      }).success,
      false,
    );
    assert.equal(
      facebookCommandSchema.safeParse({
        type: "review_rules",
        requestId,
        destinationId: requestId,
        expectedVersion: 1,
        sourceUrl: destination.url,
        summary: "Rules",
        observedAt: bad,
        expiresAt: now,
        decision: "allowed",
      }).success,
      false,
    );
    assert.equal(
      facebookCommandSchema.safeParse({
        type: "review_rules",
        requestId,
        destinationId: requestId,
        expectedVersion: 1,
        sourceUrl: destination.url,
        summary: "Rules",
        observedAt: now,
        expiresAt: bad,
        decision: "allowed",
      }).success,
      false,
    );
    assert.equal(
      facebookCommandSchema.safeParse({
        type: "capture_destination",
        requestId,
        destination: {
          ...destination,
          observation: { ...destination.observation, observedAt: bad },
        },
      }).success,
      false,
    );
    assert.equal(
      facebookCommandSchema.safeParse({
        type: "capture_source",
        requestId,
        destinationId: requestId,
        source: { ...source, observedAt: bad },
      }).success,
      false,
    );
    assert.equal(
      facebookDiscoveryBatchSchema.safeParse({
        version: 1,
        purpose: "facebook_public_discovery",
        externalRunId: "run",
        observedAt: bad,
        observations: [],
      }).success,
      false,
    );
  }
  const command = {
    type: "capture_source",
    requestId,
    destinationId: requestId,
    source,
  };
  assert.equal(facebookCommandSchema.safeParse(command).success, true);
  assert.equal(
    facebookCommandSchema.safeParse({
      ...command,
      source: { ...source, sourceUrl: "https://example.com" },
    }).success,
    false,
  );
  assert.equal(
    facebookCommandSchema.safeParse({
      ...command,
      source: { ...source, permission: "allowed" },
    }).success,
    false,
  );
  assert.deepEqual(
    facebookCommandSchema.parse(command),
    facebookCommandSchema.parse({
      ...command,
      source: { ...source, observedAt: now.toISOString() },
    }),
  );
});
