import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { loadMetricsSnapshot } from "../../../lib/operations/metrics/snapshot-repository";
import {
  requestMetricExport,
  readMetricExport,
  runMetricExport,
} from "../../../lib/operations/metrics/export-repository";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("metrics enforce actor policies, unknown finance, correction markers and audited scoped background exports", async () => {
  const admin = postgres(url, { max: 1 }),
    db = postgres(url, {
      max: 1,
      connection: { options: "-c role=operations_founder" },
    }),
    founder = { actorId: "e".repeat(64) },
    other = { actorId: "f".repeat(64) },
    accountId = `acct_metric${randomUUID().replaceAll("-", "")}`,
    scope = { accountId, mode: "test" as const };
  const now = new Date().toISOString(),
    today = now.slice(0, 10),
    filters = { organisationId: randomUUID(), from: today, to: today };
  try {
    await assert.rejects(loadMetricsSnapshot(db, null));
    for (const actor of ["", "invalid"])
      await db.begin(async (tx) => {
        await tx`select set_config('operations.actor_id',${actor},true)`;
        for (const table of ["invoices", "requests"]) {
          const rows = await tx`select id from operations.${tx(table)} limit 1`;
          assert.equal(rows.length, 0);
        }
      });
    const first = await loadMetricsSnapshot(db, founder, filters, {
      providerScope: scope,
    });
    assert.equal(first.freshness, "unknown");
    assert.equal(first.cash, null);
    assert.equal(first.correctedAt, null);
    assert.equal(first.revenue.active, "0");
    await admin`insert into operations.billing_provider_events(account_id,environment,provider_event_id,event_type,object_id,payload_hash,occurred_at,received_at,state,completed_at) values(${accountId},'test','evt_late','invoice.paid','in_late',${"a".repeat(64)},${today}::date-interval '1 day',${now},'completed',${now})`;
    const corrected = await loadMetricsSnapshot(
      db,
      founder,
      {
        ...filters,
        from: new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
          .toISOString()
          .slice(0, 10),
      },
      { providerScope: scope },
    );
    assert.ok(corrected.correctedAt);
    const id = await requestMetricExport(db, founder, filters, scope);
    assert.equal((await readMetricExport(db, founder, id))?.state, "queued");
    assert.equal(await readMetricExport(db, other, id), null);
    assert.equal(await runMetricExport(db, founder, id), true);
    assert.equal(await runMetricExport(db, founder, id), false);
    const result = await readMetricExport(db, founder, id, true);
    assert.match(result?.csv ?? "", /Definition version/);
    const events = await admin<
      { action: string }[]
    >`select action from operations.metric_export_audit where job_id=${id} order by created_at,id`;
    assert.deepEqual(
      events.map((e) => e.action),
      ["requested", "completed", "downloaded"],
    );
    const [portal] = await admin<
      { allowed: boolean }[]
    >`select has_table_privilege('operations_portal','operations.metric_export_jobs','select') as allowed`;
    assert.equal(portal.allowed, false);
  } finally {
    await db.end();
    await admin.end();
  }
});
