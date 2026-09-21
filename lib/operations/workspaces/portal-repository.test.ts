import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { listPortalNotifications } from "./portal-repository";

const identity = {
  email: "alex@example.test",
  emailVerified: true as const,
  userId: "11111111-1111-4111-8111-111111111111",
};
const organisationId = "22222222-2222-4222-8222-222222222222";
const correlationId = "33333333-3333-4333-8333-333333333333";

function portalDb(statements: string[]): OperationsDb {
  const query = async <T>(
    parts: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> => {
    const statement = parts.join("?");
    statements.push(`${statement} | ${values.map(String).join("|")}`);
    if (statement.includes("current_user"))
      return [{ name: "operations_portal" }] as T;
    if (statement.includes("from operations.memberships"))
      return [{ role: "owner", userId: identity.userId }] as T;
    if (statement.includes("from operations.request_notifications"))
      return [
        {
          body: "Your decision is needed.",
          createdAt: "2026-09-21T10:30:00.000Z",
          id: "44444444-4444-4444-8444-444444444444",
          kind: "review_requested",
          readAt: null,
          requestId: "55555555-5555-4555-8555-555555555555",
          requestVersion: 3,
          title: "Booking flow v3",
        },
      ] as T;
    return [] as T;
  };
  return {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
}

test("action-needed notifications are selected by the current review state in SQL", async () => {
  const statements: string[] = [];

  const result = await listPortalNotifications(
    portalDb(statements),
    identity,
    organisationId,
    correlationId,
    "action_needed",
    1,
  );

  assert.equal(result.items[0]?.title, "Booking flow v3");
  assert.ok(
    statements.some(
      (statement) =>
        statement.includes("join operations.requests r") &&
        statement.includes("n.kind = 'review_requested'") &&
        statement.includes("r.status = 'ready_for_review'"),
    ),
  );
});
