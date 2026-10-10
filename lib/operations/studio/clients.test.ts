import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { listStudioClients, loadStudioClient } from "./clients";

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
    return sql.includes("set_config") || sql.includes("assert_active")
      ? []
      : rows;
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("lists authorised Studio clients with contact, active-work and next-action data", async () => {
  const row = {
    activeWorkCount: 2,
    displayName: "Northstar Studio",
    id: "44444444-4444-4444-8444-444444444444",
    legalName: "Northstar Studio Ltd",
    lifecycle: "active",
    nextAction: "Review client work",
    nextActionHref: "/portal/admin/clients/44444444-4444-4444-8444-444444444444/requests",
    primaryContactName: "Alex Morgan",
  };
  const { calls, db } = recordingDb([row]);

  const result = await listStudioClients(db, admin, {
    page: 1,
    query: "  northstar  ",
  });

  assert.deepEqual(result.items, [row]);
  assert.equal(result.page, 1);
  assert.equal(result.hasNext, false);
  assert.ok(calls.some(({ values }) => values.includes("northstar")));
  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations\.assert_active_staff_membership/,
  );
});

test("rejects ambiguous or oversized Studio client searches before database access", async () => {
  const { calls, db } = recordingDb([]);

  await assert.rejects(listStudioClients(db, admin, { query: ["north"] }));
  await assert.rejects(
    listStudioClients(db, admin, { query: "n".repeat(101) }),
  );

  assert.equal(calls.length, 0);
});

test("published offers become the client-register next action", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  const offerId = "55555555-5555-4555-8555-555555555555";
  const row = {
    activeWorkCount: 0,
    displayName: "Northstar Studio",
    id,
    legalName: "Northstar Studio Ltd",
    lifecycle: "active" as const,
    nextAction: "Review client offer",
    nextActionHref: `/portal/admin/clients/${id}/commercial-offers/${offerId}/preview`,
    primaryContactName: "Alex Morgan",
  };
  const { calls, db } = recordingDb([row]);

  const result = await listStudioClients(db, admin);
  const query = calls.map(({ sql }) => sql).join("\n");

  assert.equal(result.items[0].nextAction, "Review client offer");
  assert.equal(result.items[0].nextActionHref, row.nextActionHref);
  assert.match(query, /operations\.commercial_offers/);
  assert.match(query, /f\.status in \('published', 'proposed', 'rejected'\)/);
  assert.match(query, /f\.expires_at > clock_timestamp\(\)/);
});

test("loads a selected client hub through the FSS-admin boundary and keeps offer separate from agreement count", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  const offerId = "55555555-5555-4555-8555-555555555555";
  const row = {
    activeJourneyCount: 1,
    activeProjectCount: 1,
    agreementCount: 0,
    billingExceptionCount: 0,
    billingCurrency: "USD" as const,
    currencyVersion: 1,
    displayName: "Northstar Studio",
    id,
    legalName: "Northstar Studio Ltd",
    lifecycle: "active" as const,
    nextAction: "Review client offer",
    nextActionHref: `/portal/admin/clients/${id}/commercial-offers/${offerId}/preview`,
    openRequestCount: 0,
    primaryContactName: "Alex Morgan",
    timezone: "Europe/London",
  };
  const { calls, db } = recordingDb([row]);

  const result = await loadStudioClient(db, admin, id);
  const query = calls.map(({ sql }) => sql).join("\n");

  assert.deepEqual(result, row);
  assert.equal(result?.agreementCount, 0);
  assert.match(query, /operations\.commercial_offers/);
  assert.match(query, /f\.status in \('published', 'proposed', 'rejected'\)/);
  assert.match(query, /f\.expires_at > clock_timestamp\(\)/);
  assert.match(query, /select count\(\*\)::integer from operations\.agreements a/);
  assert.match(query, /operations\.assert_active_staff_membership/);
});
