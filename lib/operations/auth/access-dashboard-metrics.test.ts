import assert from "node:assert/strict";
import test from "node:test";
import { getPortalAccessMetrics } from "./access-dashboard-metrics";
import type { PortalAccessEntry } from "./repository";

const now = new Date("2026-09-12T12:00:00.000Z");

function entry(overrides: Partial<PortalAccessEntry>): PortalAccessEntry {
  return {
    organisationId: "8aa24c0b-3665-4fd4-8694-500675c943c3",
    organisationName: "Example Ltd",
    contactId: "4b5e28e8-15bc-4b51-b92e-715872ca727e",
    name: "Taylor Example",
    email: "taylor@example.test",
    membershipId: null,
    role: "viewer",
    revokedAt: null,
    invitedAt: null,
    inviteExpiresAt: null,
    inviteClaimedAt: null,
    ...overrides,
  };
}

test("summarises active, pending and claimed portal access accurately", () => {
  const metrics = getPortalAccessMetrics(
    [
      entry({ membershipId: "member-active", role: "owner" }),
      entry({
        invitedAt: new Date("2026-09-11T12:00:00.000Z"),
        inviteExpiresAt: new Date("2026-09-19T12:00:00.000Z"),
        role: "contributor",
      }),
      entry({
        invitedAt: new Date("2026-09-11T12:00:00.000Z"),
        inviteClaimedAt: new Date("2026-09-12T10:00:00.000Z"),
        role: "billing_contact",
      }),
      entry({
        invitedAt: new Date("2026-09-01T12:00:00.000Z"),
        inviteExpiresAt: new Date("2026-09-08T12:00:00.000Z"),
      }),
      entry({ membershipId: "member-revoked", revokedAt: now }),
    ],
    now,
  );

  assert.deepEqual(metrics, {
    active: 1,
    pending: 1,
    claimed: 1,
    roleCounts: [
      {
        value: "owner",
        label: "Owner",
        detail: "Full project, agreement and account access.",
        count: 1,
      },
      {
        value: "contributor",
        label: "Contributor",
        detail: "Project access, requests and shared files.",
        count: 1,
      },
      {
        value: "billing_contact",
        label: "Billing contact",
        detail: "Billing records and payment management.",
        count: 1,
      },
      {
        value: "viewer",
        label: "Viewer",
        detail: "Read-only projects, documents and services.",
        count: 2,
      },
    ],
  });
});
