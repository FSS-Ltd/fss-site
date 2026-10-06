import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { deleteStudioInvitation } from "./portal-invitation-delete";

const invitationId = "44444444-4444-4444-8444-444444444444";
const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function fixture() {
  const calls: string[] = [];
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    if (sql.includes('as "organisationId"'))
      return [{ organisationId: "55555555-5555-4555-8555-555555555555" }];
    if (sql.includes("prepare_access_invitation_delete"))
      return [{ invitationEmail: "client@example.test" }];
    return [];
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("deletion rechecks staff and invitation scope before exact provider revocation", async () => {
  const { db, calls } = fixture();
  const revoked: unknown[][] = [];
  await deleteStudioInvitation(
    db,
    admin,
    null,
    { invitationId, kind: "client", reviewReference: "review-42" },
    async (...args) => {
      revoked.push(args);
    },
  );
  assert.deepEqual(revoked, [["client@example.test", invitationId, "portal"]]);
  assert.match(calls.join("\n"), /assert_active_staff_membership/);
  assert.match(calls.join("\n"), /prepare_access_invitation_delete/);
  assert.match(calls.join("\n"), /finish_access_invitation_delete/);
});

test("provider failure leaves the invitation visible for a retry", async () => {
  const { db, calls } = fixture();
  await assert.rejects(
    deleteStudioInvitation(
      db,
      admin,
      null,
      { invitationId, kind: "client", reviewReference: "review-42" },
      async () => {
        throw new Error("provider unavailable");
      },
    ),
    /provider unavailable/,
  );
  assert.doesNotMatch(calls.join("\n"), /finish_access_invitation_delete/);
});

test("staff deletion requires founder capability", async () => {
  const { db, calls } = fixture();
  await assert.rejects(
    deleteStudioInvitation(db, admin, null, {
      invitationId,
      kind: "staff",
      reviewReference: "review-42",
    }),
    { name: "PortalAccessDenied" },
  );
  assert.equal(calls.length, 0);
});

test("legacy rows stay visible when an exact provider invitation cannot be identified", async () => {
  const { db, calls } = fixture();
  let providerCalled = false;
  await assert.rejects(
    deleteStudioInvitation(
      db,
      admin,
      null,
      { invitationId, kind: "legacy", reviewReference: "review-42" },
      async () => {
        providerCalled = true;
      },
    ),
    /cannot be identified safely/,
  );
  assert.equal(providerCalled, false);
  assert.doesNotMatch(calls.join("\n"), /finish_access_invitation_delete/);
});
