import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { saveStudioSettingsDraft, StudioSettingsConflict } from "./settings";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

const input = {
  deliveryCapacity: "standard",
  displayName: "Faithful Software Solutions",
  expectedRevision: 2,
  replyTo: "studio@faithfulsoftware.dev",
  responseExpectationHours: 48,
  timezone: "Europe/London",
};

function recordingDb(currentRevision = 2): { calls: Array<{ sql: string; values: unknown[] }>; db: OperationsDb } {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("set_config") || sql.includes("assert_active") || sql.includes("pg_advisory")) return [];
    if (sql.includes("select revision")) return currentRevision ? [{ revision: currentRevision }] : [];
    if (sql.includes("insert into operations.studio_settings_drafts")) return [{ createdAt: "2026-09-21T10:00:00.000Z", revision: currentRevision + 1 }];
    return [];
  };
  return { calls, db: { begin: (run: (tx: OperationsTransaction) => Promise<unknown>) => run(query as unknown as OperationsTransaction) } as unknown as OperationsDb };
}

test("records a revisioned operational draft with the staff audit actor", async () => {
  const { calls, db } = recordingDb();
  const saved = await saveStudioSettingsDraft(
    db,
    admin,
    input,
    "44444444-4444-4444-8444-444444444444",
    ["studio@faithfulsoftware.dev"],
  );
  assert.equal(saved.revision, 3);
  assert.match(calls.map(({ sql }) => sql).join("\n"), /operations\.assert_active_staff_membership/);
  assert.ok(calls.some(({ values }) => values.includes(admin.actorId)));
});

test("rejects unapproved sender input and stale revisions before inserting", async () => {
  const { calls, db } = recordingDb();
  await assert.rejects(
    saveStudioSettingsDraft(db, admin, { ...input, replyTo: "forged@example.test" }, "44444444-4444-4444-8444-444444444444", ["studio@faithfulsoftware.dev"]),
  );
  assert.equal(calls.length, 0);
  const stale = recordingDb(3);
  await assert.rejects(
    saveStudioSettingsDraft(stale.db, admin, input, "44444444-4444-4444-8444-444444444444", ["studio@faithfulsoftware.dev"]),
    StudioSettingsConflict,
  );
  assert.equal(stale.calls.some(({ sql }) => sql.includes("insert into operations.studio_settings_drafts")), false);
});
