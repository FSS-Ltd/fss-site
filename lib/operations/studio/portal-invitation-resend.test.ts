import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { resendStudioInvitation } from "./portal-invitation-resend";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};
const oldId = "44444444-4444-4444-8444-444444444444";
const organisationId = "55555555-5555-4555-8555-555555555555";
const command = {
  action: "resend_invitation" as const,
  invitationId: oldId,
  kind: "client" as const,
  reviewReference: "review-42",
};

function fixture(
  options: {
    organisationId?: string | null;
    stale?: boolean;
  } = {},
): { db: OperationsDb; calls: string[] } {
  const calls: string[] = [];
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    if (sql.includes('as "organisationId"'))
      return [
        {
          organisationId:
            options.organisationId === undefined
              ? organisationId
              : options.organisationId,
        },
      ];
    if (sql.includes("resend_portal_invitation")) {
      if (options.stale)
        throw Object.assign(new Error("Invitation unavailable."), {
          code: "P0002",
        });
      return [
        {
          invitationName: "Reviewed Client",
          invitationEmail: "client@example.test",
        },
      ];
    }
    if (sql.includes("resend_staff_invitation"))
      return [
        {
          invitationName: "Reviewed Staff",
          invitationEmail: "staff@example.test",
        },
      ];
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

test("resend uses the selected row and revokes its exact provider invitation before sending", async () => {
  const { db, calls } = fixture();
  const events: string[] = [];
  await resendStudioInvitation(
    db,
    admin,
    null,
    command,
    "https://portal.example.test",
    async (email, url, metadata) => {
      events.push("send");
      assert.equal(email, "client@example.test");
      assert.match(url, /decline_token=/);
      assert.equal(metadata?.version, 2);
      assert.notEqual(
        "invitationId" in (metadata ?? {}) && metadata.invitationId,
        oldId,
      );
    },
    async (email, invitationId, realm) => {
      events.push("revoke");
      assert.deepEqual(
        [email, invitationId, realm],
        ["client@example.test", oldId, "portal"],
      );
    },
  );
  assert.deepEqual(events, ["revoke", "send"]);
  assert.match(calls.join("\n"), /assert_active_staff_membership/);
  assert.match(calls.join("\n"), /resend_portal_invitation/);
});

test("stale invitation cannot produce a second provider request", async () => {
  const { db } = fixture({ stale: true });
  let providerCalled = false;
  await assert.rejects(
    resendStudioInvitation(
      db,
      admin,
      null,
      command,
      "https://portal.example.test",
      async () => {
        providerCalled = true;
      },
    ),
    /Invitation changed/,
  );
  assert.equal(providerCalled, false);
});

test("ordinary admins cannot resend staff or unscoped client invitations", async () => {
  const staff = fixture();
  await assert.rejects(
    resendStudioInvitation(
      staff.db,
      admin,
      null,
      { ...command, kind: "staff" },
      "https://portal.example.test",
    ),
    { name: "PortalAccessDenied" },
  );
  assert.equal(staff.calls.length, 0);
  const unscoped = fixture({ organisationId: null });
  await assert.rejects(
    resendStudioInvitation(
      unscoped.db,
      admin,
      null,
      command,
      "https://portal.example.test",
    ),
    { name: "PortalAccessDenied" },
  );
  assert.doesNotMatch(unscoped.calls.join("\n"), /resend_portal_invitation/);
});

test("provider failure records the replacement as failed without claiming delivery", async () => {
  const { db, calls } = fixture();
  let sent = false;
  await assert.rejects(
    resendStudioInvitation(
      db,
      admin,
      null,
      command,
      "https://portal.example.test",
      async () => {
        sent = true;
      },
      async () => {
        throw new Error("provider unavailable");
      },
    ),
    /provider unavailable/,
  );
  assert.equal(sent, false);
  assert.match(calls.join("\n"), /fail_pending_portal_invitation/);
});
