import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  savePortalProfile,
  saveUserProfile,
  userProfileNameSchema,
} from "./user-profile";

const identity = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "owner@example.test",
  emailVerified: true as const,
};
const correlationId = "20000000-0000-4000-8000-000000000001";

function profileDb(
  statements: string[],
  role: "owner" | "viewer" = "owner",
): OperationsDb {
  const query = async <T>(
    parts: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> => {
    statements.push(`${parts.join("?")} | ${values.map(String).join("|")}`);
    if (parts.join("").includes("current_user"))
      return [{ name: "operations_portal" }] as T;
    if (parts.join("").includes("from operations.memberships"))
      return [{ userId: identity.userId, role }] as T;
    return [] as T;
  };
  return {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
}

test("profile saves accept only a bounded display name and return its normalised value", async () => {
  const statements: string[] = [];

  const saved = await saveUserProfile(
    profileDb(statements),
    identity,
    "  Alex Morgan  ",
    correlationId,
  );

  assert.deepEqual(saved, { displayName: "Alex Morgan" });
  assert.ok(
    statements.some((statement) =>
      statement.includes("operations.upsert_user_profile"),
    ),
  );
  assert.equal(
    userProfileNameSchema.safeParse({ role: "owner" }).success,
    false,
  );
});

test("portal profile saves require the organisation settings capability", async () => {
  const organisationId = "30000000-0000-4000-8000-000000000001";

  assert.deepEqual(
    await savePortalProfile(
      profileDb([]),
      identity,
      organisationId,
      "Alex Morgan",
      correlationId,
    ),
    { displayName: "Alex Morgan" },
  );
  await assert.rejects(
    savePortalProfile(
      profileDb([], "viewer"),
      identity,
      organisationId,
      "Alex Morgan",
      correlationId,
    ),
    /access/i,
  );
});
