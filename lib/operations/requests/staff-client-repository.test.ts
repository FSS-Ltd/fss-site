import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";

const organisationId = "11111111-1111-4111-8111-111111111111";
const context: FssAdminContext = {
  realm: "staff",
  membershipId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  actorId: "1ec68d221aa0a052e20f4208db78701c1ef2f6c47b1210fa30a1d4de47d605b1",
  role: "admin",
  correlationId: "44444444-4444-4444-8444-444444444444",
};

type ListStaffClientRequests = (
  db: OperationsDb,
  admin: FssAdminContext,
  clientId: string,
) => Promise<{
  items: Array<{ id: string; title: string }>;
  page: number;
  hasNext: boolean;
}>;

type GetStaffClientContext = (
  db: OperationsDb,
  admin: FssAdminContext,
  clientId: string,
) => Promise<{
  projectCount: number;
  openRequestCount: number;
  requestCount: number;
} | null>;

test("staff client request reads recheck staff access before loading the client queue", async () => {
  const calls: string[] = [];
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    if (sql.includes("from operations.requests"))
      return [{ id: "request-1", title: "Review delivery" }];
    return [];
  };
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
  const loaded: unknown = await import("./staff-client-repository").catch(
    () => null,
  );
  const candidate =
    loaded && typeof loaded === "object"
      ? Reflect.get(loaded, "listStaffClientRequests")
      : null;

  assert.equal(typeof candidate, "function");
  if (typeof candidate !== "function") return;

  const listStaffClientRequests = candidate as ListStaffClientRequests;
  const requests = await listStaffClientRequests(db, context, organisationId);

  assert.deepEqual(requests, {
    items: [{ id: "request-1", title: "Review delivery" }],
    page: 1,
    hasNext: false,
  });
  assert.ok(
    calls.findIndex((sql) => sql.includes("assert_active_staff_membership")) <
      calls.findIndex((sql) => sql.includes("from operations.requests")),
  );
});

test("staff client context derives project and open-request counts from authorised records", async () => {
  let clientQuery = "";
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    if (sql.includes("from operations.organisations")) {
      clientQuery = sql;
      return [{ projectCount: 2, openRequestCount: 5, requestCount: 7 }];
    }
    return [];
  };
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
  const loaded: unknown = await import("./staff-client-repository");
  const candidate =
    loaded && typeof loaded === "object"
      ? Reflect.get(loaded, "getStaffClientContext")
      : null;

  assert.equal(typeof candidate, "function");
  if (typeof candidate !== "function") return;

  const getStaffClientContext = candidate as GetStaffClientContext;
  assert.deepEqual(await getStaffClientContext(db, context, organisationId), {
    projectCount: 2,
    openRequestCount: 5,
    requestCount: 7,
  });
  assert.match(clientQuery, /as "projectCount"/);
  assert.match(clientQuery, /as "openRequestCount"/);
});
