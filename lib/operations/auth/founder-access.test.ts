import assert from "node:assert/strict";
import test from "node:test";
import {
  getFounderAccessMetrics,
  type FounderAccessEntry,
} from "./founder-access";

const entry = (
  overrides: Partial<FounderAccessEntry> = {},
): FounderAccessEntry => ({
  id: "entry",
  accessType: "client",
  name: "Client",
  email: "client@example.test",
  userId: "user-1",
  membershipId: "member-1",
  organisationId: "org-1",
  organisationName: "Client Ltd",
  role: "owner",
  state: "active",
  invitedAt: "2026-09-10T12:00:00Z",
  joinedAt: "2026-09-11T12:00:00Z",
  ...overrides,
});

test("overview counts verified people once across organisations and staff access", () => {
  const metrics = getFounderAccessMetrics(
    [
      entry(),
      entry({ id: "other-org", organisationId: "org-2" }),
      entry({
        id: "staff",
        accessType: "admin",
        role: "admin",
        organisationId: null,
      }),
      entry({ id: "viewer", userId: "user-2", role: "viewer" }),
      entry({ id: "unverified", userId: null }),
      ...(["revoked", "expired", "provider_failed", "inactive"] as const).map(
        (state) => entry({ id: state, state, userId: state }),
      ),
    ],
    3,
  );
  assert.equal(metrics.uniqueActiveUsers, 2);
  assert.equal(metrics.clientUsers, 2);
  assert.equal(metrics.admins, 1);
  assert.equal(metrics.organisations, 3);
  assert.deepEqual(
    metrics.roleCounts.map(({ value, count }) => [value, count]),
    [
      ["admin", 1],
      ["owner", 1],
      ["contributor", 0],
      ["billing_contact", 0],
      ["viewer", 1],
    ],
  );
});

test("pending counts normalize email, exclude existing active people and history", () => {
  const metrics = getFounderAccessMetrics(
    [
      entry(),
      entry({ state: "pending", userId: null }),
      entry({ state: "pending", email: " New@Example.test ", userId: null }),
      entry({
        state: "pending",
        accessType: "admin",
        role: "admin",
        email: "new@example.test",
        userId: null,
      }),
      entry({ state: "expired", email: "expired@example.test", userId: null }),
      entry({
        state: "provider_failed",
        email: "failed@example.test",
        userId: null,
      }),
    ],
    1,
  );
  assert.equal(metrics.pendingInvitations, 1);
});

test("attention counts invitation identities once and excludes membership history", () => {
  const metrics = getFounderAccessMetrics(
    [
      entry({
        id: "client-invitation:expired",
        membershipId: null,
        userId: null,
        state: "expired",
        email: " New@Example.test ",
      }),
      entry({
        id: "staff:failed",
        membershipId: null,
        userId: null,
        state: "provider_failed",
        email: "new@example.test",
      }),
      entry({ id: "membership:revoked", state: "revoked" }),
    ],
    1,
  );
  assert.equal(Reflect.get(metrics, "attentionInvitations"), 1);
});
