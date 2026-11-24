import assert from "node:assert/strict";
import test from "node:test";
import {
  assessAccountReadiness,
  type AccountReadinessSnapshot,
} from "./account-readiness";

const now = new Date("2026-11-17T12:00:00Z");
const snapshot: AccountReadinessSnapshot = {
  identity: {
    connected: true,
    subjectMatches: true,
    grantMatches: true,
    scopesValid: true,
  },
  limits: {
    observedAt: new Date("2026-11-17T10:00:00Z"),
    expiresAt: new Date("2026-11-18T10:00:00Z"),
    messages: 500,
    recipients: [1000, 1000, 1000, 1000],
    perMessage: 100,
    messageReserve: 50,
    recipientReserve: 10,
  },
  health: {
    source: "measured health log",
    observedFrom: new Date("2026-11-17T09:00:00Z"),
    observedUntil: new Date("2026-11-17T10:00:00Z"),
    expiresAt: new Date("2026-11-18T10:00:00Z"),
    complete: true,
    verdict: "healthy",
    sends: 5,
    attempts: 5,
    hardBounces: 0,
    complaints: 0,
    rateIncidents: 0,
    authIncidents: 0,
    authentication: {
      spf: { status: "pass", source: "SPF record" },
      dkim: { status: "pass", source: "DKIM test" },
      dmarc: { status: "pass", source: "DMARC pass; policy p=none" },
    },
  },
  usage: {
    capturedAt: new Date("2026-11-17T11:59:00Z"),
    expiresAt: new Date("2026-11-17T12:02:00Z"),
    complete: true,
    grantMatches: true,
    messages: 10,
    recipients: 10,
  },
};

test("readiness requires complete, fresh evidence and preserves headroom", () => {
  assert.deepEqual(assessAccountReadiness(snapshot, now), { status: "ready" });
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, health: { ...snapshot.health!, complaints: null } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, health: { ...snapshot.health!, hardBounces: 1 } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      {
        ...snapshot,
        usage: {
          ...snapshot.usage!,
          capturedAt: new Date("2026-11-17T11:54:00Z"),
        },
      },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      {
        ...snapshot,
        limits: { ...snapshot.limits!, recipients: [1000, 1000, 15, 1000] },
      },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, identity: { ...snapshot.identity, grantMatches: false } },
      now,
    ).status,
    "held",
  );
});

test("unknown or failed sender authentication prevents readiness", () => {
  for (const field of ["spf", "dkim", "dmarc"] as const) {
    for (const status of ["unknown", "fail"] as const) {
      const authentication = {
        ...snapshot.health!.authentication,
        [field]: { status, source: "private evidence" },
      };
      assert.equal(
        assessAccountReadiness(
          { ...snapshot, health: { ...snapshot.health!, authentication } },
          now,
        ).status,
        "held",
      );
    }
  }
});

test("each incident and missing signal blocks healthy status", () => {
  for (const field of [
    "hardBounces",
    "complaints",
    "rateIncidents",
    "authIncidents",
  ] as const) {
    for (const value of [null, 1]) {
      assert.equal(
        assessAccountReadiness(
          { ...snapshot, health: { ...snapshot.health!, [field]: value } },
          now,
        ).status,
        "held",
      );
    }
  }
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, health: { ...snapshot.health!, sends: 0 } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, health: { ...snapshot.health!, complete: false } },
      now,
    ).status,
    "held",
  );
});

test("each recipient constraint and explicit freshness boundary is enforced", () => {
  for (let i = 0; i < 4; i++) {
    const recipients: [number, number, number, number] = [
      1000, 1000, 1000, 1000,
    ];
    recipients[i] = 20;
    assert.equal(
      assessAccountReadiness(
        { ...snapshot, limits: { ...snapshot.limits!, recipients } },
        now,
      ).status,
      "held",
    );
  }
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, limits: { ...snapshot.limits!, messageReserve: 49 } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      {
        ...snapshot,
        limits: {
          ...snapshot.limits!,
          expiresAt: new Date("2026-11-17T11:59:00Z"),
        },
      },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, usage: { ...snapshot.usage!, grantMatches: false } },
      now,
    ).status,
    "held",
  );
  assert.equal(
    assessAccountReadiness(
      {
        ...snapshot,
        health: {
          ...snapshot.health!,
          expiresAt: new Date("2026-11-19T10:00:00Z"),
        },
      },
      now,
    ).status,
    "held",
  );
});

test("missing health measurement source is held", () => {
  assert.equal(
    assessAccountReadiness(
      { ...snapshot, health: { ...snapshot.health!, source: "  " } },
      now,
    ).status,
    "held",
  );
  const health = { ...snapshot.health! };
  Reflect.deleteProperty(health, "source");
  assert.equal(
    assessAccountReadiness({ ...snapshot, health }, now).status,
    "held",
  );
});
