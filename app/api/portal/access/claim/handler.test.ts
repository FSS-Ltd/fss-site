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

function claimRequest(): Request {
  return new Request("https://portal.example.test/api/portal/access/claim", {
    method: "POST",
    body: JSON.stringify({ displayName: "Owner Example" }),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://portal.example.test",
    },
  });
}

function createDependencies(
  overrides: Partial<PortalAccessClaimDependencies> = {},
): PortalAccessClaimDependencies {
  return {
    configured: () => true,
    origin: () => "https://portal.example.test",
    createCorrelationId: () => "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
    identity: async () => identity,
    invitationClaim: async () => null,
    db: () => db,
    claimClerkInvitation: async () => false,
    claimStaffInvitation: async () => false,
    claimStaffInvitationForVerifiedEmail: async () => false,
    reconcilePendingClerkStaffInvitations: async () => undefined,
    reconcilePendingClerkPortalInvitations: async () => undefined,
    claimPendingInvitation: async () => null,
    hasActiveStaffMembership: async () => null,
    claimVerifiedEmailInvite: async () => false,
    hasActiveMembership: async () => false,
    needsOnboarding: async () => false,
    studioEnabled: () => true,
    reportUnexpectedError: () => undefined,
    ...overrides,
  };
}

test("returns onboarding-required for a verified owner with a pending invitation", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ needsOnboarding: async () => true }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: false,
    destination: "onboarding",
    onboardingRequired: true,
    outcome: "onboarding_required",
  });
});

test("returns session-pending when Clerk has not exposed the new session", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ identity: async () => null }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "session_pending",
  });
});

test("reports the identity stage when Clerk context is unavailable", async () => {
  const reports: unknown[] = [];
  const post = createPortalAccessClaimHandler(
    createDependencies({
      identity: async () => {
        throw new Error("Clerk context is unavailable");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "unavailable",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
      errorName: "Error",
      stage: "identity",
    },
  ]);
});

test("returns active when the verified user already has a portal membership", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({ hasActiveMembership: async () => true }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    destination: "portal",
    outcome: "active",
  });
});

test("returns active when an existing Clerk session claims a pending staff invitation by email", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimStaffInvitationForVerifiedEmail: async () => true,
    }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    destination: "admin",
    outcome: "active",
  });
});

test("reconciles the pending Clerk staff invitation after an email claim", async () => {
  const reconciledEmails: string[] = [];
  const post = createPortalAccessClaimHandler({
    ...createDependencies({
      claimStaffInvitationForVerifiedEmail: async () => true,
    }),
    reconcilePendingClerkStaffInvitations: async (email: string) => {
      reconciledEmails.push(email);
    },
  });

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(reconciledEmails, ["owner@example.test"]);
});

test("reconciles the pending Clerk staff invitation for an active Admin", async () => {
  const reconciledEmails: string[] = [];
  const post = createPortalAccessClaimHandler({
    ...createDependencies(),
    hasActiveStaffMembership: async () => ({
      membershipId: "0f2a8c8e-8e9d-4603-9c72-107718235ff2",
      userId: identity.userId,
      role: "admin",
    }),
    reconcilePendingClerkStaffInvitations: async (email: string) => {
      reconciledEmails.push(email);
    },
  });

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(reconciledEmails, ["owner@example.test"]);
});

test("reports Clerk invitation reconciliation failures without exposing details", async () => {
  const reports: unknown[] = [];
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimStaffInvitationForVerifiedEmail: async () => true,
      reconcilePendingClerkStaffInvitations: async () => {
        throw new Error("Clerk invitation API unavailable");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    destination: "admin",
    outcome: "active",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
      errorName: "Error",
      stage: "clerk_staff_invitation_reconciliation",
    },
  ]);
});

test("staff access takes precedence over stale client invitation metadata", async () => {
  let clientClaimed = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimClerkInvitation: async () => {
        clientClaimed = true;
        return true;
      },
      hasActiveStaffMembership: async () => ({
        membershipId: "0f2a8c8e-8e9d-4603-9c72-107718235ff2",
        userId: identity.userId,
        role: "admin",
      }),
    }),
  );
  const response = await post(claimRequest());
  assert.equal((await response.json()).destination, "admin");
  assert.equal(clientClaimed, false);
});

test("metadata-based staff claims also reconcile pending Clerk invitations", async () => {
  let reconciled = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimStaffInvitation: async () => true,
      reconcilePendingClerkStaffInvitations: async () => {
        reconciled = true;
      },
    }),
  );
  assert.equal((await post(claimRequest())).status, 200);
  assert.equal(reconciled, true);
});

test("reads the Clerk invitation once and stops after a successful staff claim", async () => {
  let invitationReads = 0;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      invitationClaim: async () => {
        invitationReads += 1;
        return null;
      },
      claimStaffInvitation: async () => true,
      claimStaffInvitationForVerifiedEmail: async () => {
        throw new Error("should not continue after a successful claim");
      },
    }),
  );

  const response = await post(claimRequest());

  assert.equal(invitationReads, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    destination: "admin",
    outcome: "active",
  });
});

test("reports the staff-invitation claim stage without exposing the error", async () => {
  const reports: unknown[] = [];
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimStaffInvitation: async () => {
        throw new Error("staff invite database query failed");
      },
      reportUnexpectedError: (report) => reports.push(report),
    }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "unavailable",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
      errorName: "Error",
      stage: "staff_invitation_claim",
    },
  ]);
});

test("returns access-denied when no active membership or pending invitation exists", async () => {
  const post = createPortalAccessClaimHandler(createDependencies());

  const response = await post(claimRequest());

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "access_denied",
  });
});

test("keeps an active staff member out of the Studio route until its release gate is enabled", async () => {
  const post = createPortalAccessClaimHandler(
    createDependencies({
      hasActiveStaffMembership: async () => ({
        membershipId: "84b943cb-b9a3-4c69-9df1-3913068431d5",
        userId: identity.userId,
        role: "admin",
      }),
      studioEnabled: () => false,
    }),
  );

  const response = await post(claimRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    active: true,
    destination: "portal",
    outcome: "active",
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

  const response = await post(claimRequest());

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    active: false,
    outcome: "unavailable",
  });
  assert.deepEqual(reports, [
    {
      correlationId: "b4d5ce58-dd9e-4a6f-a58b-bc39f0826b68",
      errorName: "Error",
      stage: "membership",
    },
  ]);
});

test("existing client accounts use database invitations and reconcile only client invitations", async () => {
  let clientReconciled = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimPendingInvitation: async () => "portal",
      reconcilePendingClerkPortalInvitations: async () => {
        clientReconciled = true;
      },
      reconcilePendingClerkStaffInvitations: async () => {
        assert.fail("Client claims cannot revoke staff invitations");
      },
    }),
  );
  assert.equal(
    (await (await post(claimRequest())).json()).destination,
    "portal",
  );
  assert.equal(clientReconciled, true);
});

test("first-owner acceptance reconciles Clerk before organisation onboarding", async () => {
  let reconciled = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimPendingInvitation: async () => "onboarding",
      reconcilePendingClerkPortalInvitations: async () => {
        reconciled = true;
      },
    }),
  );
  const result = await (await post(claimRequest())).json();
  assert.equal(result.destination, "onboarding");
  assert.equal(result.active, false);
  assert.equal(reconciled, true);
});

test("cross-origin requests cannot save profiles or claim access", async () => {
  let saved = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      saveProfile: async () => {
        saved = true;
      },
    }),
  );
  const request = new Request(
    "https://portal.example.test/api/portal/access/claim",
    {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Forged name" }),
    },
  );
  assert.equal((await post(request)).status, 403);
  assert.equal(saved, false);
});

test("a current database invitation is claimed before stale completed client metadata", async () => {
  let currentClaimed = false;
  const post = createPortalAccessClaimHandler(
    createDependencies({
      claimClerkInvitation: async () => true,
      claimPendingInvitation: async () => {
        currentClaimed = true;
        return "onboarding";
      },
    }),
  );
  const result = await (await post(claimRequest())).json();
  assert.equal(result.destination, "onboarding");
  assert.equal(currentClaimed, true);
});
