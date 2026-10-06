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
  parameters: unknown[][];
  db: OperationsDb;
} {
  const calls: string[] = [];
  const parameters: unknown[][] = [];
  let index = 0;
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push(sql);
    parameters.push(values);
    if (sql.includes("set_config") || sql.includes("assert_active")) return [];
    if (sql.includes("issue_pending_portal_invitation")) {
      return [
        { id: "77777777-7777-4777-8777-777777777777", expiresAt: new Date() },
      ];
    }
    return rows[index++] ?? [];
  };
  return {
    calls,
    parameters,
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
        total: 1,
        items: [
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
      },
    ],
  ]);
  const result = await listStudioPortalAccess(db, admin, {
    page: 1,
    query: "north",
  });
  assert.equal(result.items[0]?.state, "active");
  assert.equal(result.totalPages, 1);
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
  assert.throws(() =>
    staffPortalAccessOperationSchema.parse({
      action: "delete_invitation",
      invitationId: "44444444-4444-4444-8444-444444444444",
      kind: "client",
      reviewReference: " ",
    }),
  );
});

test("new-client invitations accept only identity and review details", () => {
  assert.deepEqual(
    staffPortalAccessOperationSchema.parse({
      action: "invite_client",
      name: "Sam Example",
      email: "sam@example.test",
      reviewReference: "review-42",
    }),
    {
      action: "invite_client",
      name: "Sam Example",
      email: "sam@example.test",
      reviewReference: "review-42",
    },
  );
  for (const extra of [
    { role: "viewer" },
    { organisationId: "55555555-5555-4555-8555-555555555555" },
  ]) {
    assert.throws(() =>
      staffPortalAccessOperationSchema.parse({
        action: "invite_client",
        name: "Sam Example",
        email: "sam@example.test",
        reviewReference: "review-42",
        ...extra,
      }),
    );
  }
});

test("active admins issue audited owner invitations without selecting an organisation", async () => {
  const { db, calls, parameters } = recordingDb([]);
  const delivered: string[] = [];
  const result = await applyStaffPortalAccessOperation(
    db,
    admin,
    {
      action: "invite_client",
      name: "Sam Example",
      email: " SAM@EXAMPLE.TEST ",
      reviewReference: "review-42",
    },
    "https://portal.example.test",
    async (email, redirectUrl, metadata) => {
      delivered.push(email, redirectUrl, JSON.stringify(metadata));
    },
  );
  assert.deepEqual(result, { status: "sent" });
  assert.equal(delivered[0], "sam@example.test");
  const redirect = new URL(delivered[1] ?? "");
  assert.equal(redirect.origin, "https://portal.example.test");
  assert.equal(redirect.pathname, "/activate");
  assert.equal(redirect.searchParams.get("name"), "Sam Example");
  assert.equal(redirect.searchParams.get("email"), "sam@example.test");
  const issueIndex = calls.findIndex((sql) =>
    sql.includes("issue_pending_portal_invitation"),
  );
  const metadata: unknown = JSON.parse(delivered[2] ?? "null");
  assert.deepEqual(metadata, {
    version: 2,
    invitationId: parameters[issueIndex]?.[0],
    email: "sam@example.test",
  });
  assert.ok(
    calls.some((sql) => sql.includes("assert_active_staff_membership")),
  );
  assert.ok(
    issueIndex >
      calls.findIndex((sql) => sql.includes("assert_active_staff_membership")),
  );
  assert.ok(parameters[issueIndex]?.includes("owner"));
  assert.ok(parameters.some((values) => values.includes(admin.actorId)));
  assert.ok(parameters[issueIndex]?.includes("review-42"));
});

test("failed new-client delivery marks its audited invitation as failed", async () => {
  const { db, calls } = recordingDb([]);
  await assert.rejects(
    applyStaffPortalAccessOperation(
      db,
      admin,
      {
        action: "invite_client",
        name: "Sam Example",
        email: "sam@example.test",
        reviewReference: "review-42",
      },
      "https://portal.example.test",
      async () => {
        throw new Error("provider unavailable");
      },
    ),
    /provider unavailable/,
  );
  assert.ok(
    calls.some((sql) => sql.includes("fail_pending_portal_invitation")),
  );
});

test("dashboard totals come from a full aggregate, not the visible page", async () => {
  const { db } = recordingDb([
    [],
    [{ total: 0, items: [] }],
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

test("access pages use ten rows and clamp a page emptied by deletion", async () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: `client-invitation:${String(index).padStart(2, "0")}`,
    state: "pending",
  }));
  const first = recordingDb([[], [{ total: 21, items }], []]);
  const overview = await listStudioPortalAccess(first.db, admin, {
    page: 2,
    view: "invitations",
  });
  assert.equal(overview.items.length, 10);
  assert.equal(overview.page, 2);
  assert.equal(overview.totalPages, 3);
  assert.equal(overview.hasNext, true);
  const registerSql =
    first.calls.find((sql) => sql.includes("with access as")) ?? "";
  assert.match(registerSql, /limit \?/);
  assert.match(registerSql, /offset \(\(least\(/);
  assert.match(registerSql, /p\.state not in \('accepted', 'completed'\)/);
  assert.match(registerSql, /p\.dismissed_at is null/);

  const afterDelete = recordingDb([[], [{ total: 20, items }], []]);
  const clamped = await listStudioPortalAccess(afterDelete.db, admin, {
    page: 3,
    view: "invitations",
  });
  assert.equal(clamped.page, 2);
  assert.equal(clamped.totalPages, 2);
  assert.equal(clamped.hasNext, false);
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
      [{ total: 0, items: [] }],
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

test("accepted invitations leave the register without entering the pending total", async () => {
  const { db, calls, parameters } = recordingDb([
    [],
    [{ total: 0, items: [] }],
    [
      {
        clientUsers: 0,
        admins: 0,
        pendingInvitations: 0,
        attentionInvitations: 0,
      },
    ],
  ]);
  const result = await listStudioPortalAccess(db, admin, {
    page: 1,
    view: "invitations",
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.metrics.pendingInvitations, 0);
  const registerQuery =
    calls.find((sql) => sql.includes("client-invitation:")) ?? "";
  assert.match(registerQuery, /p\.state not in \('accepted', 'completed'\)/);
  assert.match(
    registerQuery,
    /coalesce\(p\.target_organisation_id, p\.organisation_id\) is not null/,
  );
  const metricsQuery =
    calls.find((sql) => sql.includes("pending_access")) ?? "";
  assert.match(
    metricsQuery,
    /p\.state = 'pending' and p\.expires_at > now\(\)/,
  );
  assert.ok(parameters.some((values) => values.includes(true)));
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
