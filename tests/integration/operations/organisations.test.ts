import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("operations schema is isolated from public and Growth runtime access", async () => {
  const sql = postgres(url, { max: 1 });
  try {
    const [row] = await sql<
      { exists: boolean }[]
    >`select to_regclass('operations.organisations') is not null as exists`;
    assert.equal(row.exists, true);
    const [role] = await sql<
      { rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }[]
    >`select rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = 'operations_founder'`;
    assert.deepEqual(role, {
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
    });
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "growth_app",
    ]) {
      const [privilege] = await sql<
        { allowed: boolean }[]
      >`select has_schema_privilege(${role}, 'operations', 'usage') as allowed`;
      assert.equal(privilege.allowed, false, role);
    }
  } finally {
    await sql.end();
  }
});

test("reviewed imports run as founder, preserve history, reject conflicts and keep pooled context local", async () => {
  const { randomUUID } = await import("node:crypto");
  const { applyReviewedMapping, listOrganisations } =
    await import("../../../lib/operations/organisations/repository");
  const { createEngagement } = await import("./fixtures");
  const admin = postgres(url, { max: 1 });
  const runtime = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_founder" },
  });
  const ids = [randomUUID(), randomUUID()];
  const founder = { actorId: "a".repeat(64) };
  const fixtures: Awaited<ReturnType<typeof createEngagement>>[] = [];
  try {
    const [role] = await runtime<
      { name: string }[]
    >`select current_user as name`;
    assert.equal(role.name, "operations_founder");
    fixtures.push(await createEngagement(admin), await createEngagement(admin));
    const mapping = {
      reviewReference: "integration-review",
      organisations: [
        {
          id: ids[0],
          legalName: "Reviewed Limited",
          displayName: "Reviewed",
          tradingStatus: "active",
          timezone: "Europe/London",
          engagementIds: fixtures.map((fixture) => fixture.engagementId),
        },
      ],
    };
    await assert.rejects(
      applyReviewedMapping(runtime, null, mapping),
      /Founder authorization/,
    );
    const concurrent = await Promise.all([
      applyReviewedMapping(runtime, founder, mapping),
      applyReviewedMapping(runtime, founder, mapping),
    ]);
    assert.equal(
      concurrent.reduce((sum, result) => sum + result.organisationsCreated, 0),
      1,
    );
    assert.equal(
      concurrent.reduce((sum, result) => sum + result.engagementsLinked, 0),
      2,
    );
    assert.deepEqual(await applyReviewedMapping(runtime, founder, mapping), {
      organisationsCreated: 0,
      engagementsLinked: 0,
    });
    assert.deepEqual(
      (await listOrganisations(runtime, founder)).rows.find(
        (row) => row.id === ids[0],
      ),
      {
        id: ids[0],
        legalName: "Reviewed Limited",
        displayName: "Reviewed",
        tradingStatus: "active",
        timezone: "Europe/London",
        lifecycle: "active",
        engagementCount: 2,
      },
    );
    await assert.rejects(
      applyReviewedMapping(runtime, founder, {
        ...mapping,
        organisations: [{ ...mapping.organisations[0], id: ids[1] }],
      }),
      /conflicts/,
    );
    await assert.rejects(
      applyReviewedMapping(runtime, founder, {
        ...mapping,
        organisations: [{ ...mapping.organisations[0], legalName: "Changed" }],
      }),
      /conflicts/,
    );
    await assert.rejects(
      applyReviewedMapping(runtime, founder, {
        ...mapping,
        organisations: [
          {
            ...mapping.organisations[0],
            id: ids[1],
            engagementIds: [randomUUID()],
          },
        ],
      }),
      { code: "23503" },
    );
    const [absent] = await admin<
      { count: number }[]
    >`select count(*)::int as count from operations.organisations where id = ${ids[1]}`;
    assert.equal(absent.count, 0, "conflict rolls back the whole mapping");
    const [audit] = await admin<
      { count: number }[]
    >`select count(*)::int as count from operations.audit_events where organisation_id = ${ids[0]}`;
    assert.equal(audit.count, 3, "replays never duplicate audit evidence");
    const [context] = await runtime<
      { actor: string | null }[]
    >`select nullif(current_setting('operations.actor_id', true), '') as actor`;
    assert.equal(context.actor, null);
    assert.equal(
      (await runtime`select id from operations.organisations`).length,
      0,
    );
    await assert.rejects(
      runtime`insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${ids[1]}, 'Unauthorised', 'Unauthorised', 'active', 'UTC', ${founder.actorId}, 'review')`,
      { code: "42501" },
    );
    await assert.rejects(
      runtime`update operations.engagement_links set organisation_id = ${ids[1]}`,
      { code: "42501" },
    );
    await assert.rejects(runtime`delete from operations.organisations`, {
      code: "42501",
    });
    await assert.rejects(
      runtime`update operations.audit_events set review_reference = 'forged'`,
      { code: "42501" },
    );
    await assert.rejects(runtime`select * from growth.delivery_engagements`, {
      code: "42501",
    });
    const history = await admin<
      { stage: string; version: number }[]
    >`select stage, version from growth.delivery_engagements where id = any(${fixtures.map((fixture) => fixture.engagementId)}::uuid[])`;
    assert.equal(history.length, 2);
    assert.ok(history.every((row) => row.stage === "new" && row.version === 1));
  } finally {
    await runtime.end();
    await admin`delete from operations.audit_events where organisation_id = any(${ids}::uuid[])`;
    await admin`delete from operations.engagement_links where organisation_id = any(${ids}::uuid[])`;
    await admin`delete from operations.organisations where id = any(${ids}::uuid[])`;
    for (const fixture of fixtures) {
      await admin`delete from growth.delivery_engagements where id = ${fixture.engagementId}`;
      await admin`delete from growth.prospects where id = ${fixture.prospectId}`;
      await admin`delete from growth.contacts where id = ${fixture.contactId}`;
      await admin`delete from growth.businesses where id = ${fixture.businessId}`;
    }
    await admin.end();
  }
});

test("founder list pagination is bounded and validates selectors before querying", async () => {
  const { randomUUID } = await import("node:crypto");
  const { listOrganisations } =
    await import("../../../lib/operations/organisations/repository");
  const admin = postgres(url, { max: 1 });
  const runtime = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const ids = Array.from({ length: 51 }, () => randomUUID()).sort();
  const founder = { actorId: "b".repeat(64) };
  try {
    await runtime.begin(async (tx) => {
      await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
      for (const id of ids)
        await tx`insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference) values (${id}, 'Pagination', 'Pagination', 'unknown', 'UTC', ${founder.actorId}, 'pagination-test')`;
    });
    const first = await listOrganisations(runtime, founder);
    assert.equal(first.rows.length, 50);
    assert.ok(first.nextCursor);
    const second = await listOrganisations(runtime, founder, first.nextCursor);
    assert.equal(second.rows.length, 1);
    assert.equal(second.nextCursor, null);
    assert.equal(
      (await listOrganisations(runtime, founder, ids[50])).rows.length,
      0,
    );
    await assert.rejects(listOrganisations(runtime, founder, "invalid-cursor"));
    await assert.rejects(
      listOrganisations(runtime, null),
      /Founder authorization/,
    );
  } finally {
    await runtime.end();
    await admin`delete from operations.audit_events where organisation_id = any(${ids}::uuid[])`;
    await admin`delete from operations.organisations where id = any(${ids}::uuid[])`;
    await admin.end();
  }
});
