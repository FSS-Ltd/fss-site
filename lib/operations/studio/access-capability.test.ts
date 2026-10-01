import assert from "node:assert/strict";
import test from "node:test";
import { hasStudioFounderCapability } from "./access-capability";
import type { FssAdminContext } from "../auth/staff-types";
const admin: FssAdminContext = {
  realm: "staff",
  role: "admin",
  userId: "user-1",
  actorId: "a".repeat(64),
  membershipId: "membership-1",
  correlationId: "correlation-1",
};
test("founder capability requires the same verified identity and configured owner", () => {
  const identity = {
    userId: "user-1",
    email: " Owner@Example.test ",
    emailVerified: true as const,
  };
  assert.equal(
    hasStudioFounderCapability(admin, identity, "owner@example.test"),
    true,
  );
  assert.equal(
    hasStudioFounderCapability(
      admin,
      { ...identity, userId: "other-user" },
      "owner@example.test",
    ),
    false,
  );
  assert.equal(
    hasStudioFounderCapability(admin, identity, "other@example.test"),
    false,
  );
  assert.equal(hasStudioFounderCapability(admin, identity, undefined), false);
  assert.equal(
    hasStudioFounderCapability(admin, null, "owner@example.test"),
    false,
  );
});
