import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { FssAdminContext } from "./staff-types";

const context: FssAdminContext = {
  realm: "staff",
  membershipId: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  actorId: "1ec68d221aa0a052e20f4208db78701c1ef2f6c47b1210fa30a1d4de47d605b1",
  role: "admin",
  correlationId: "33333333-3333-4333-8333-333333333333",
};

type WithFssAdminTransaction = <T>(
  db: OperationsDb,
  admin: FssAdminContext,
  run: (tx: OperationsTransaction) => Promise<T>,
) => Promise<T>;

test("staff transactions recheck the grant before running an Operations query", async () => {
  const calls: { sql: string; values: unknown[] }[] = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: parts.join("?"), values });
    return [];
  };
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
  const loaded: unknown = await import("./staff-transaction").catch(
    () => null,
  );
  const candidate =
    loaded && typeof loaded === "object"
      ? Reflect.get(loaded, "withFssAdminTransaction")
      : null;

  assert.equal(typeof candidate, "function");
  if (typeof candidate !== "function") return;

  const withFssAdminTransaction = candidate as WithFssAdminTransaction;
  const result = await withFssAdminTransaction(db, context, async (tx) => {
    await tx`select 1`;
    return "complete";
  });

  assert.equal(result, "complete");
  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations.assert_active_staff_membership/,
  );
  assert.deepEqual(calls[0]?.values, [
    context.userId,
    context.actorId,
    context.correlationId,
  ]);
});
