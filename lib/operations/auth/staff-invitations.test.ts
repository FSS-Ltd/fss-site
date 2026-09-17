import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { PortalAccessDenied } from "./types";
import {
  issueStaffInvitation,
  failStaffInvitation,
  revokeStaffInvitation,
  revokeStaffMembership,
  claimClerkStaffInvitation,
  getActiveStaffMembership,
  staffInvitationSchema,
} from "./staff-invitations";
import { requireFssAdmin } from "./require-admin";
import { createStaffInvitationMetadata } from "./clerk-invitation";

const userId = "11111111-1111-4111-8111-111111111111";
const membershipId = randomUUID();
const invitationId = randomUUID();
const correlationId = randomUUID();
const identity = {
  userId,
  email: "admin@example.test",
  emailVerified: true,
} as const;
const founder = { actorId: "a".repeat(64) };

// Only the PostgreSQL transport is replaced; validation and authorization run unchanged.
function recordingDb(
  rows: Record<string, unknown>[],
  role = "operations_portal",
) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    return sql.includes("current_user")
      ? [{ name: role }]
      : sql.includes("set_config")
        ? []
        : rows;
  };
  // postgres.js callable transaction types include transport methods unused by these repositories.
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
  return { db, calls };
}

test("staff issue requires founder authority and maps normalized reviewed input", async () => {
  const expiresAt = new Date("2026-10-01T00:00:00Z");
  const { db, calls } = recordingDb([{ id: invitationId, expiresAt }]);
  const input = {
    name: " Admin ",
    email: " ADMIN@EXAMPLE.TEST ",
    reviewReference: " Reviewed ",
  };
  await assert.rejects(
    issueStaffInvitation(db, null, input, invitationId, correlationId),
    /Founder/,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    staffInvitationSchema.safeParse({ ...input, role: "owner" }).success,
    false,
  );
  assert.deepEqual(
    await issueStaffInvitation(db, founder, input, invitationId, correlationId),
    { invitationId, expiresAt },
  );
  assert.deepEqual(calls.at(-1)?.values, [
    invitationId,
    "Admin",
    "admin@example.test",
    "Reviewed",
    correlationId,
  ]);
});

test("membership revocation checks founder context and calls only the membership boundary", async () => {
  const { db, calls } = recordingDb([]);
  const input = {
    staffMembershipId: membershipId,
    reviewReference: " Reviewed ",
  };
  await assert.rejects(
    revokeStaffMembership(db, null, input, correlationId),
    /Founder/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    revokeStaffMembership(
      db,
      founder,
      { ...input, invitationId },
      correlationId,
    ),
  );
  await revokeStaffMembership(db, founder, input, correlationId);
  assert.match(calls.at(-1)?.sql ?? "", /operations.revoke_staff_membership/);
  assert.deepEqual(calls.at(-1)?.values, [
    membershipId,
    "Reviewed",
    correlationId,
  ]);
});

test("staff provider failure and revocation require founder authority and a review", async () => {
  const { db, calls } = recordingDb([]);
  await assert.rejects(
    failStaffInvitation(db, null, invitationId, correlationId),
    /Founder/,
  );
  await assert.rejects(
    revokeStaffInvitation(db, null, invitationId, "review", correlationId),
    /Founder/,
  );
  assert.equal(calls.length, 0);
  await failStaffInvitation(db, founder, invitationId, correlationId);
  assert.deepEqual(calls.at(-1)?.values, [invitationId, correlationId]);
  await assert.rejects(
    revokeStaffInvitation(db, founder, invitationId, "", correlationId),
  );
  await revokeStaffInvitation(
    db,
    founder,
    invitationId,
    " Revoked by founder ",
    correlationId,
  );
  assert.deepEqual(calls.at(-1)?.values, [
    invitationId,
    "Revoked by founder",
    correlationId,
  ]);
});

test("staff claim uses only verified server identity and only staff metadata", async () => {
  const { db, calls } = recordingDb([{ membershipId }]);
  const invitation = createStaffInvitationMetadata({
    invitationId,
    email: identity.email,
  });
  assert.deepEqual(invitation, {
    version: 3,
    realm: "staff",
    role: "admin",
    invitationId,
    email: identity.email,
  });
  const claim = { clerkUserId: "user_staff", identity, invitation };
  assert.equal(await claimClerkStaffInvitation(db, null, correlationId), false);
  assert.equal(
    await claimClerkStaffInvitation(
      db,
      {
        ...claim,
        invitation: { version: 2, invitationId, email: identity.email },
      },
      correlationId,
    ),
    false,
  );
  assert.equal(
    await claimClerkStaffInvitation(
      db,
      { ...claim, identity: { ...identity, email: "wrong@example.test" } },
      correlationId,
    ),
    false,
  );
  assert.equal(calls.length, 0);
  assert.equal(await claimClerkStaffInvitation(db, claim, correlationId), true);
  assert.deepEqual(calls.at(-1)?.values, [invitationId]);
  assert.deepEqual(
    calls.find(({ sql }) => sql.includes("set_config"))?.values,
    [userId, identity.email, correlationId],
  );
});

test("Admin guard requires an active staff grant, never client membership", async () => {
  const { db } = recordingDb([{ membershipId, userId, role: "admin" }]);
  assert.deepEqual(await requireFssAdmin(db, identity, correlationId), {
    realm: "staff",
    membershipId,
    userId,
    actorId: "1ec68d221aa0a052e20f4208db78701c1ef2f6c47b1210fa30a1d4de47d605b1",
    role: "admin",
    correlationId,
  });
  for (const rows of [
    [],
    [{ membershipId, userId, role: "owner" }],
    [{ membershipId, userId: randomUUID(), role: "admin" }],
  ]) {
    const denied = recordingDb(rows);
    assert.equal(
      await getActiveStaffMembership(denied.db, identity, correlationId),
      null,
    );
    await assert.rejects(
      requireFssAdmin(denied.db, identity, correlationId),
      PortalAccessDenied,
    );
    assert.ok(
      denied.calls.some(({ sql }) => sql.includes("active_staff_membership")),
    );
  }
  await assert.rejects(
    requireFssAdmin(db, null, correlationId),
    PortalAccessDenied,
  );
  await assert.rejects(
    requireFssAdmin(
      recordingDb([], "operations_founder").db,
      identity,
      correlationId,
    ),
    PortalAccessDenied,
  );
});
