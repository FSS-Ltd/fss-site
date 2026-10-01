import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  applyActiveStudioSettings,
  loadActiveStudioSettings,
  readActiveStudioSettings,
  readPortalStudioPresentationSettings,
  ActiveStudioSettingsConflict,
} from "./active-settings";
import { defaultActiveStudioSettings } from "./active-settings-types";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};
function recordingDb(revision = 0, failAudit = false) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const active = { ...defaultActiveStudioSettings, revision };
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("insert into operations.studio_settings_active"))
      return [{ revision: revision + 1 }];
    if (
      sql.includes("insert into operations.studio_settings_audit") &&
      failAudit
    )
      throw new Error("audit unavailable");
    if (sql.includes("from operations.studio_settings_active"))
      return revision ? [active] : [];
    if (sql.includes("portal_studio_presentation_settings"))
      return [
        {
          revision,
          displayName: active.displayName,
          timezone: active.timezone,
          responseExpectationHours: active.responseExpectationHours,
        },
      ];
    return [];
  };
  Object.assign(query, { json: (value: unknown) => value });
  return {
    active,
    calls,
    tx: query as unknown as OperationsTransaction,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("active consumers receive safe defaults and never query historical drafts", async () => {
  const fixture = recordingDb();
  assert.deepEqual(
    await readActiveStudioSettings(fixture.tx),
    defaultActiveStudioSettings,
  );
  assert.deepEqual(
    await loadActiveStudioSettings(fixture.db, admin),
    defaultActiveStudioSettings,
  );
  assert.ok(
    fixture.calls.some(({ sql }) =>
      sql.includes("assert_active_staff_membership"),
    ),
  );
  assert.ok(
    fixture.calls.every(({ sql }) => !sql.includes("studio_settings_drafts")),
  );
});

test("applies only the selected section, increments active revision, and records before/after audit atomically", async () => {
  const fixture = recordingDb(4);
  const result = await applyActiveStudioSettings(
    fixture.db,
    admin,
    {
      section: "identity",
      expectedRevision: 4,
      values: { displayName: "  FSS Studio  " },
    },
    admin.correlationId,
  );
  assert.deepEqual(result, {
    ...fixture.active,
    displayName: "FSS Studio",
    revision: 5,
  });
  assert.ok(
    fixture.calls.some(({ sql }) => sql.includes("pg_advisory_xact_lock")),
  );
  const audit = fixture.calls.find(({ sql }) =>
    sql.includes("insert into operations.studio_settings_audit"),
  );
  assert.ok(audit);
  assert.ok(audit.values.includes(admin.actorId));
  assert.ok(
    audit.values.some(
      (value) => JSON.stringify(value) === JSON.stringify(fixture.active),
    ),
  );
  assert.ok(
    audit.values.some(
      (value) => JSON.stringify(value) === JSON.stringify(result),
    ),
  );
  const failing = recordingDb(4, true);
  await assert.rejects(
    applyActiveStudioSettings(
      failing.db,
      admin,
      {
        section: "delivery",
        expectedRevision: 4,
        values: { deliveryCapacity: "limited" },
      },
      admin.correlationId,
    ),
    /audit unavailable/,
  );
});

test("stale section updates retain current settings in a conflict and never append", async () => {
  const fixture = recordingDb(6);
  await assert.rejects(
    applyActiveStudioSettings(
      fixture.db,
      admin,
      {
        section: "identity",
        expectedRevision: 4,
        values: { displayName: "FSS" },
      },
      admin.correlationId,
    ),
    (error: unknown) => {
      assert.ok(error instanceof ActiveStudioSettingsConflict);
      assert.deepEqual(error.current, fixture.active);
      return true;
    },
  );
  assert.equal(
    fixture.calls.some(({ sql }) => sql.includes("insert into")),
    false,
  );
});

test("validates typed section boundaries and approved reply-to before accessing the database", async () => {
  for (const input of [
    {
      section: "identity",
      expectedRevision: 0,
      values: { displayName: "FSS", timezone: "Europe/London" },
    },
    {
      section: "timezone",
      expectedRevision: 0,
      values: { timezone: "Not/AZone" },
    },
    {
      section: "communication",
      expectedRevision: 0,
      values: { replyTo: "forged@example.test", responseExpectationHours: 48 },
    },
    {
      section: "communication",
      expectedRevision: 0,
      values: { replyTo: null, responseExpectationHours: 169 },
    },
    {
      section: "delivery",
      expectedRevision: "0",
      values: { deliveryCapacity: "standard" },
    },
    {
      section: "delivery",
      expectedRevision: 0,
      values: { deliveryCapacity: "unlimited" },
    },
  ]) {
    const fixture = recordingDb();
    await assert.rejects(
      applyActiveStudioSettings(fixture.db, admin, input, admin.correlationId),
      z.ZodError,
    );
    assert.equal(fixture.calls.length, 0);
  }
});

test("applies approved reply-to and validates all section variants", async () => {
  const communication = recordingDb();
  const result = await applyActiveStudioSettings(
    communication.db,
    admin,
    {
      section: "communication",
      expectedRevision: 0,
      values: { replyTo: "Studio@Example.test", responseExpectationHours: 24 },
    },
    admin.correlationId,
    ["studio@example.test"],
  );
  assert.equal(result.replyTo, "studio@example.test");
  assert.equal(result.responseExpectationHours, 24);
  const timezone = recordingDb();
  assert.equal(
    (
      await applyActiveStudioSettings(
        timezone.db,
        admin,
        {
          section: "timezone",
          expectedRevision: 0,
          values: { timezone: "America/New_York" },
        },
        admin.correlationId,
      )
    ).timezone,
    "America/New_York",
  );
  const delivery = recordingDb();
  assert.equal(
    (
      await applyActiveStudioSettings(
        delivery.db,
        admin,
        {
          section: "delivery",
          expectedRevision: 0,
          values: { deliveryCapacity: "limited" },
        },
        admin.correlationId,
      )
    ).deliveryCapacity,
    "limited",
  );
});

test("portal read uses only an organisation-authorized presentation function", async () => {
  const fixture = recordingDb();
  const presentation = await readPortalStudioPresentationSettings(
    fixture.tx,
    admin.membershipId,
  );
  assert.deepEqual(Object.keys(presentation).sort(), [
    "displayName",
    "responseExpectationHours",
    "revision",
    "timezone",
  ]);
  assert.ok(
    fixture.calls[0].sql.includes(
      "operations.portal_studio_presentation_settings",
    ),
  );
  assert.ok(fixture.calls[0].values.includes(admin.membershipId));
});
