import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { listFounderAccessOverview } from "./founder-access-repository";
import type { OperationsFounder } from "../organisations/types";

const founder: OperationsFounder = {
  actorId: "1ec68d221aa0a052e20f4208db78701c1ef2f6c47b1210fa30a1d4de47d605b1",
};

test("founder access applies URL filters and page bounds in SQL", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const query = async (
    parts: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<unknown[]> => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("from operations.organisations where lifecycle"))
      return [{ count: 3 }];
    if (sql.includes("pending_access"))
      return [
        {
          uniqueActiveUsers: 4,
          clientUsers: 3,
          admins: 1,
          pendingInvitations: 2,
        },
      ];
    if (sql.includes("group by role"))
      return [
        { role: "owner", count: 2 },
        { role: "admin", count: 1 },
      ];
    if (sql.includes("'membership:'"))
      return Array.from({ length: 26 }, (_, index) => ({
        id: `membership:${index}`,
        accessType: "client",
        name: `Alex ${index}`,
        email: `alex-${index}@example.test`,
        userId: `user-${index}`,
        membershipId: `membership-${index}`,
        organisationId: "11111111-1111-4111-8111-111111111111",
        organisationName: "Example client",
        role: "owner",
        state: "active",
        invitedAt: new Date("2026-01-01T00:00:00.000Z"),
        joinedAt: new Date("2026-01-02T00:00:00.000Z"),
      }));
    return [];
  };
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;

  const overview = await listFounderAccessOverview(db, founder, {
    page: "2",
    query: "Alex",
    accessType: "client",
    state: "active",
  });

  assert.equal(overview.page, 2);
  assert.equal(overview.hasNext, true);
  assert.equal(overview.entries.length, 25);
  assert.deepEqual(overview.filters, {
    query: "Alex",
    accessType: "client",
    state: "active",
  });
  assert.equal(overview.metrics.uniqueActiveUsers, 4);
  assert.equal(overview.metrics.organisations, 3);
  assert.equal(
    overview.metrics.roleCounts.find((role) => role.value === "owner")?.count,
    2,
  );
  const registerQuery = calls.find((call) =>
    call.sql.includes("'membership:'"),
  );
  assert.match(registerQuery?.sql ?? "", /limit \? offset \?/);
  assert.deepEqual(registerQuery?.values.slice(-2), [26, 25]);
});
