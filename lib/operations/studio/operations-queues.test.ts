import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  listStudioBillingOperations,
  listStudioNotifications,
} from "./operations-queues";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function recordingDb(rows: readonly unknown[][]): {
  calls: Array<{ sql: string; values: unknown[] }>;
  db: OperationsDb;
} {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  let rowIndex = 0;
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("set_config") || sql.includes("assert_active")) return [];
    return rows[rowIndex++] ?? [];
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("lists retained billing totals and exceptions through the Staff boundary", async () => {
  const organisationId = "44444444-4444-4444-8444-444444444444";
  const { calls, db } = recordingDb([
    [
      {
        totalsByCurrency: [
          {
            currency: "GBP",
            dueThisMonthPence: "720000",
            overduePence: "240000",
          },
          { currency: "USD", dueThisMonthPence: "10000", overduePence: "0" },
        ],
        reconciliationCount: 1,
      },
    ],
    [
      {
        amountPence: "240000",
        category: "overdue_review",
        dueDate: "2026-09-12",
        id: "55555555-5555-4555-8555-555555555555",
        lastObservedAt: "2026-09-18T10:00:00.000Z",
        organisationId,
        organisationName: "Elm & Co",
        providerReference: "in_test123",
      },
    ],
  ]);

  const queue = await listStudioBillingOperations(db, admin, { page: 1 });

  assert.equal(queue.totalsByCurrency[0]?.dueThisMonthPence, "720000");
  assert.equal(queue.totalsByCurrency[0]?.overduePence, "240000");
  assert.equal(queue.reconciliationCount, 1);
  assert.equal(queue.totalsByCurrency[1]?.currency, "USD");
  assert.match(calls.map(({ sql }) => sql).join("\n"), /group by i.currency/);
  assert.equal(queue.items[0]?.providerReference, "in_test123");
  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations\.assert_active_staff_membership/,
  );
});

test("filters notification deliveries without trusting browser status values", async () => {
  const { calls, db } = recordingDb([
    [
      {
        attempts: 2,
        id: "55555555-5555-4555-8555-555555555555",
        kind: "review_requested",
        lastError: "provider_timeout",
        nextAttemptAt: "2026-09-22T10:00:00.000Z",
        organisationId: "44444444-4444-4444-8444-444444444444",
        organisationName: "Elm & Co",
        recipient: "alex@elm.example",
        requestId: "66666666-6666-4666-8666-666666666666",
        requestTitle: "Approve updated booking flow",
        status: "pending",
        updatedAt: "2026-09-21T10:00:00.000Z",
      },
    ],
  ]);

  const page = await listStudioNotifications(db, admin, {
    page: 1,
    status: "retry",
  });

  assert.equal(page.items[0]?.recipientLabel, "a***@elm.example");
  assert.equal(page.items[0]?.status, "pending");
  assert.ok(calls.some(({ values }) => values.includes("pending")));
  await assert.rejects(
    listStudioNotifications(db, admin, { page: 1, status: "bogus" }),
  );
});
