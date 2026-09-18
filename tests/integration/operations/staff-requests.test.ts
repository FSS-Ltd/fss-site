import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { deliveryFounder } from "./project-document-fixtures";
import {
  newRequest,
  requestFixture,
  removeRequestFixture,
} from "./request-fixtures";
import { createPortalRequest } from "../../../lib/operations/requests/service";
import { executeStaffRequestCommand } from "../../../lib/operations/requests/staff-service";
import { requireFssAdmin } from "../../../lib/operations/auth/require-admin";
import {
  claimStaffInvitationForVerifiedEmail,
  revokeStaffMembership,
} from "../../../lib/operations/auth/staff-invitations";
import type { FssAdminContext } from "../../../lib/operations/auth/staff-types";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

async function staffAdminFixture(
  admin: postgres.Sql,
  portalRole: postgres.Sql,
  email: string,
): Promise<FssAdminContext> {
  const userId = randomUUID();
  const invitationId = randomUUID();
  const correlationId = randomUUID();
  const identity = {
    userId,
    email,
    emailVerified: true as const,
  };
  // Issue through the founder role with a synthetic audit actor.
  await admin.begin(async (tx) => {
    await tx`set local role operations_founder`;
    await tx`select set_config('operations.actor_id', ${"b".repeat(64)}, true)`;
    await tx`select * from operations.issue_staff_invitation(${invitationId}, 'Staff Admin', ${email}, 'staff-request-test', ${correlationId})`;
  });
  // Claim through the verified portal identity adapter, then verify the grant.
  const claimed = await claimStaffInvitationForVerifiedEmail(
    portalRole,
    identity,
    correlationId,
  );
  assert.ok(claimed);
  return requireFssAdmin(portalRole, identity, correlationId);
}

test("staff request commands mutate with a staff audit actor and client roles are denied", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  const portalRole = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const email = `${randomUUID()}@example.test`;
  const adminContext = await staffAdminFixture(admin, portalRole, email);
  try {
    const payload = newRequest(f.projectId);
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      payload,
      f.correlationId,
    );
    // A client member of the same organisation must not run staff commands.
    await assert.rejects(
      executeStaffRequestCommand(
        portal,
        {
          realm: "staff",
          membershipId: randomUUID(),
          userId: f.identity.userId,
          actorId: "c".repeat(64),
          role: "admin",
          correlationId: f.correlationId,
        },
        f.organisationId,
        {
          action: "acknowledge",
          requestId: request.id,
          expectedVersion: request.version,
          ownerDisplay: "FSS",
          scope: "included",
          scopeReason: "",
        },
        f.correlationId,
      ),
      (error: unknown) => error instanceof Error,
    );
    // Staff Admin acknowledges, plans, and starts the request.
    await executeStaffRequestCommand(
      founder,
      adminContext,
      f.organisationId,
      {
        action: "acknowledge",
        requestId: request.id,
        expectedVersion: request.version,
        ownerDisplay: "FSS Delivery",
        scope: "included",
        scopeReason: "",
      },
      f.correlationId,
    );
    const planned = await executeStaffRequestCommand(
      founder,
      adminContext,
      f.organisationId,
      {
        action: "plan",
        requestId: request.id,
        expectedVersion: request.version + 1,
        nextAction: "Prepare the deliverable",
        targetDate: null,
        agreementId: null,
      },
      f.correlationId,
    );
    assert.equal(planned.version, request.version + 2);
    const audit = await admin<{ actorId: string; action: string }[]>`
      select actor_id as "actorId", action from operations.request_history
      where request_id = ${request.id} and action = 'plan'`;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actorId, adminContext.actorId);
  } finally {
    await removeRequestFixture(admin, f);
    await portalRole.end();
    await admin.end();
    await founder.end();
    await portal.end();
  }
});

test("revoked staff members lose request access on the next command", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  const portalRole = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const email = `${randomUUID()}@example.test`;
  const adminContext = await staffAdminFixture(admin, portalRole, email);
  try {
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    await executeStaffRequestCommand(
      founder,
      adminContext,
      f.organisationId,
      {
        action: "acknowledge",
        requestId: request.id,
        expectedVersion: request.version,
        ownerDisplay: "FSS Delivery",
        scope: "included",
        scopeReason: "",
      },
      f.correlationId,
    );
    // Revoke the staff membership; the next command must fail its recheck.
    await revokeStaffMembership(
      founder,
      deliveryFounder,
      { staffMembershipId: adminContext.membershipId, reviewReference: "revoke-test" },
      randomUUID(),
    );
    await assert.rejects(
      executeStaffRequestCommand(
        founder,
        adminContext,
        f.organisationId,
        {
          action: "plan",
          requestId: request.id,
          expectedVersion: request.version + 1,
          nextAction: "Should not apply",
          targetDate: null,
          agreementId: null,
        },
        f.correlationId,
      ),
    );
  } finally {
    await removeRequestFixture(admin, f);
    await portalRole.end();
    await admin.end();
    await founder.end();
    await portal.end();
  }
});
