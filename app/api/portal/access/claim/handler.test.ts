import assert from "node:assert/strict";
import test from "node:test";
import type { VerifiedPortalIdentity } from "@/lib/operations/auth/types";
import type { OperationsDb } from "@/lib/operations/db/client";
import {
  createPortalAccessClaimHandler,
  type PortalAccessClaimDependencies,
} from "./handler";

const identity: VerifiedPortalIdentity = {
  userId: "31dca7d1-9001-5a32-9d6f-aec26159f525",
  email: "owner@example.test",
  emailVerified: true,
};

// The injected claim functions do not execute database methods in these tests.
const db = {} as OperationsDb;

function createDependencies(
  overrides: Partial<PortalAccessClaimDependencies> = {},
): PortalAccessClaimDependencies {
  return {
    configured: () => true,
    createCorrelationId: () => "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
    identity: async () => identity,
    invitationClaim: async () => null,
    db: () => db,
    claimClerkInvitation: async () => false,
    claimStaffInvitation: async () => false,
    claimStaffInvitationForVerifiedEmail: async () => false,
    claimVerifiedEmailInvite: async () => false,
    hasActiveMembership: async () => false,
    needsOnboarding: async () => false,
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
}

test("returns onboarding-required for a verified owner with a pending invitation", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ needsOnboarding: async () => true }),
  );

  const response = await post();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: false,
    onboardingRequired: true,
    outcome: "onboarding_required",
  });
});

test("returns session-pending when Clerk has not exposed the new session", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ identity: async () => null }),
  );

  const response = await post();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "session_pending",
  });
});

test("returns active when the verified user already has a portal membership", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ hasActiveMembership: async () => true }),
  );

  const response = await post();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    outcome: "active",
  });
});

test("returns active when an existing Clerk session claims a pending staff invitation by email", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ claimStaffInvitationForVerifiedEmail: async () => true }),
  );

  const response = await post();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { active: true, outcome: "active" });
});

test("returns access-denied when no active membership or pending invitation exists", async () => {
  const post = createPortalAccessClaimHandler(createDependencies());

  const response = await post();

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "access_denied",
  });
});

test("returns unavailable and reports a correlation ID when the portal database fails", async () => {
  const reports: unknown[] = [];
  const post = createPortalAccessClaimHandler(
    createDependencies({
      hasActiveMembership: async () => {
        throw new Error("database offline");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await post();

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "unavailable",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
      errorName: "Error",
    },
  ]);
});
