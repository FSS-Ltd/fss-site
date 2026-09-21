import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { listStaffOrganisations } from "./staff-repository";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function recordingDb(rows: Record<string, unknown>[]): {
  calls: Array<{ sql: string; values: unknown[] }>;
  db: OperationsDb;
} {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    return sql.includes("set_config") ? [] : rows;
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("binds a trimmed client search to the FSS-admin register query", async () => {
  const row = {
    displayName: "Northstar Studio",
    engagementCount: 1,
    id: "44444444-4444-4444-8444-444444444444",
    legalName: "Northstar Studio Ltd",
    lifecycle: "active" as const,
    timezone: "Europe/London",
    tradingStatus: "active" as const,
  };
  const { calls, db } = recordingDb([row]);

  const result = await listStaffOrganisations(db, admin, {
    page: 1,
    query: "  northstar  ",
  });

  assert.deepEqual(result.rows, [row]);
  assert.ok(
    calls.some(({ values }) => values.includes("northstar")),
    "the authorised register query must bind the normalized search term",
  );
});

test("rejects an ambiguous or oversized client-register search", async () => {
  const { db } = recordingDb([]);

  await assert.rejects(
    listStaffOrganisations(db, admin, { query: ["north", "harbour"] }),
  );
  await assert.rejects(
    listStaffOrganisations(db, admin, { query: "n".repeat(101) }),
  );
});
