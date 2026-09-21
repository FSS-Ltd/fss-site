import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { listStudioPortalAccess, staffPortalAccessOperationSchema } from "./portal-access";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function recordingDb(rows: readonly unknown[][]): { calls: string[]; db: OperationsDb } {
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
    db: { begin: (run: (tx: OperationsTransaction) => Promise<unknown>) => run(query as unknown as OperationsTransaction) } as unknown as OperationsDb,
  };
}

test("lists tenant-scoped client memberships and invitations after a Staff recheck", async () => {
  const { calls, db } = recordingDb([
    [{ email: "alex@northstar.example", id: "44444444-4444-4444-8444-444444444444", name: "Alex", organisationId: "55555555-5555-4555-8555-555555555555", organisationName: "Northstar" }],
    [{ contactId: "44444444-4444-4444-8444-444444444444", email: "alex@northstar.example", expiresAt: null, id: "membership:66666666-6666-4666-8666-666666666666", invitedAt: "2026-09-20T10:00:00.000Z", lastVerifiedAt: "2026-09-20T10:00:00.000Z", membershipId: "66666666-6666-4666-8666-666666666666", name: "Alex", organisationId: "55555555-5555-4555-8555-555555555555", organisationName: "Northstar", role: "owner", state: "active" }],
  ]);
  const result = await listStudioPortalAccess(db, admin, { page: 1, query: "north" });
  assert.equal(result.items[0]?.state, "active");
  assert.equal(result.contacts[0]?.email, "a***@northstar.example");
  assert.match(calls.join("\n"), /operations\.assert_active_staff_membership/);
});

test("rejects invented roles and browser-supplied contact details", () => {
  assert.throws(() => staffPortalAccessOperationSchema.parse({ action: "invite_existing_client", contactId: "44444444-4444-4444-8444-444444444444", email: "forged@example.test", name: "Forged", organisationId: "55555555-5555-4555-8555-555555555555", reviewReference: "review", role: "admin" }));
});
