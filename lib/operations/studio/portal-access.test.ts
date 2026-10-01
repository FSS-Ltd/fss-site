import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  applyStaffPortalAccessOperation,
  listStudioPortalAccess,
  staffPortalAccessOperationSchema,
} from "./portal-access";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function recordingDb(rows: readonly unknown[][]): {
  calls: string[];
  db: OperationsDb;
} {
  const calls: string[] = [];
  let index = 0;
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    if (sql.includes("set_config") || sql.includes("assert_active")) return [];
    return rows[index++] ?? [];
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("lists tenant-scoped client memberships and invitations after a Staff recheck", async () => {
  const { calls, db } = recordingDb([
    [
      {
        email: "alex@northstar.example",
        id: "44444444-4444-4444-8444-444444444444",
        name: "Alex",
        organisationId: "55555555-5555-4555-8555-555555555555",
        organisationName: "Northstar",
      },
    ],
    [
      {
        contactId: "44444444-4444-4444-8444-444444444444",
        email: "alex@northstar.example",
        expiresAt: null,
        id: "membership:66666666-6666-4666-8666-666666666666",
        invitedAt: "2026-09-20T10:00:00.000Z",
        lastVerifiedAt: "2026-09-20T10:00:00.000Z",
        membershipId: "66666666-6666-4666-8666-666666666666",
        name: "Alex",
        organisationId: "55555555-5555-4555-8555-555555555555",
        organisationName: "Northstar",
        role: "owner",
        state: "active",
      },
    ],
  ]);
  const result = await listStudioPortalAccess(db, admin, {
    page: 1,
    query: "north",
  });
  assert.equal(result.items[0]?.state, "active");
  assert.equal(result.contacts[0]?.email, "a***@northstar.example");
  assert.match(calls.join("\n"), /operations\.assert_active_staff_membership/);
});

test("rejects invented roles and browser-supplied contact details", () => {
  assert.throws(() =>
    staffPortalAccessOperationSchema.parse({
      action: "invite_existing_client",
      contactId: "44444444-4444-4444-8444-444444444444",
      email: "forged@example.test",
      name: "Forged",
      organisationId: "55555555-5555-4555-8555-555555555555",
      reviewReference: "review",
      role: "admin",
    }),
  );
});

test("dashboard totals come from a full aggregate, not the visible page", async () => {
  const { db } = recordingDb([
    [],
    [],
    [
      {
        clientUsers: 41,
        admins: 0,
        pendingInvitations: 12,
        attentionInvitations: 3,
      },
    ],
  ]);
  const result = await listStudioPortalAccess(db, admin, {
    page: 3,
    query: "no match",
  });
  assert.deepEqual(Reflect.get(result, "metrics"), {
    activeClientUsers: 41,
    activeStaff: 0,
    pendingInvitations: 12,
    attentionInvitations: 3,
  });
  assert.equal(Reflect.get(result, "canManageStaff"), false);
});

test("ordinary admins cannot read staff or issue staff invitations", async () => {
  const { db, calls } = recordingDb([]);
  await assert.rejects(
    listStudioPortalAccess(db, admin, { page: 1, view: "staff" }),
    { name: "PortalAccessDenied" },
  );
  await assert.rejects(
    applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "invite_admin",
        name: "Sam",
        email: "sam@example.test",
        reviewReference: "review",
      },
      "https://portal.example.test",
    ),
    { name: "PortalAccessDenied" },
  );
  assert.equal(calls.length, 0);
});

test("client contact and membership mutations require a matching organisation before provider operations", async () => {
  const organisationId = "55555555-5555-4555-8555-555555555555";
  let provisioned = false;
  const provision = async () => {
    provisioned = true;
  };
  const { db, calls } = recordingDb([]);
  await assert.rejects(
    applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "invite_existing_client",
        contactId: "44444444-4444-4444-8444-444444444444",
        organisationId,
        role: "owner",
        reviewReference: "review",
      },
      "https://portal.example.test",
      provision,
    ),
    /selected active client contact/,
  );
  await assert.rejects(
    applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "revoke_membership",
        membershipId: "66666666-6666-4666-8666-666666666666",
        organisationId,
        reviewReference: "review",
      },
      "https://portal.example.test",
      provision,
    ),
    /no longer active/,
  );
  assert.equal(provisioned, false);
  assert.match(calls.join("\n"), /c\.organisation_id = \?/);
  assert.match(calls.join("\n"), /m\.organisation_id = \?/);
});

test("all views retain tenant-matched joins and full aggregate counts", async () => {
  for (const view of ["clients", "invitations"] as const) {
    const { db, calls } = recordingDb([
      [],
      [],
      [
        {
          clientUsers: 100,
          admins: 0,
          pendingInvitations: 10,
          attentionInvitations: 2,
        },
      ],
    ]);
    const overview = await listStudioPortalAccess(db, admin, {
      page: 2,
      view,
      query: "Sam",
      state: "pending",
    });
    assert.equal(overview.view, view);
    assert.equal(overview.metrics.activeClientUsers, 100);
    const aggregate = calls.find((sql) => sql.includes("pending_access")) ?? "";
    assert.doesNotMatch(aggregate, /limit|offset|like/i);
    assert.match(aggregate, /count\(distinct user_id\)/);
    assert.match(aggregate, /count\(distinct p.email\)/);
    assert.match(calls.join("\n"), /c\.organisation_id = m\.organisation_id/);
  }
});

test("verified founder uses the existing audited staff invitation operator after an active grant recheck", async () => {
  const previous = process.env.GROWTH_OS_OWNER_EMAIL;
  process.env.GROWTH_OS_OWNER_EMAIL = "owner@example.test";
  try {
    const identity = {
      userId: admin.userId,
      email: "owner@example.test",
      emailVerified: true as const,
    };
    const { db, calls } = recordingDb([
      [
        {
          id: "77777777-7777-4777-8777-777777777777",
          expiresAt: new Date("2026-10-04T09:00:00.000Z"),
        },
      ],
    ]);
    let deliveredEmail: string | undefined;
    const result = await applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "invite_admin",
        name: "Sam",
        email: "sam@example.test",
        reviewReference: "staff-review-42",
      },
      "https://portal.example.test",
      async (email) => {
        deliveredEmail = email;
      },
      identity,
    );
    assert.deepEqual(result, { status: "sent" });
    assert.equal(deliveredEmail, "sam@example.test");
    assert.match(calls.join("\n"), /operations\.issue_staff_invitation/);
    assert.ok(
      calls.findIndex((sql) => sql.includes("assert_active_staff_membership")) <
        calls.findIndex((sql) => sql.includes("issue_staff_invitation")),
    );
  } finally {
    if (previous === undefined) delete process.env.GROWTH_OS_OWNER_EMAIL;
    else process.env.GROWTH_OS_OWNER_EMAIL = previous;
  }
});
