import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createBillingTestDatabases } from "./billing-fixtures";
import {
  requestMetricExport,
  readMetricExport,
} from "../../../lib/operations/metrics/export-repository";
import { createMetricExportHandler } from "../../../lib/operations/metrics/export-handler";
import { GET } from "../../../app/api/cron/operations-metrics/route";
import { getOperationsDb } from "../../../lib/operations/db/client";
test("real cron discovers founder queue from fresh connection and produces private audited download", async () => {
  const { admin, db } = createBillingTestDatabases(),
    email = "metric-worker@example.test",
    founder = { actorId: createHash("sha256").update(email).digest("hex") };
  const names = [
    "OPERATIONS_DATABASE_URL",
    "OPERATIONS_ENABLED",
    "OPERATIONS_METRIC_EXPORTS_ENABLED",
    "GROWTH_OS_OWNER_EMAIL",
    "CRON_SECRET",
  ] as const;
  const old = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    const url = new URL(process.env.OPERATIONS_TEST_DATABASE_URL!);
    url.searchParams.set("options", "-c role=operations_founder");
    process.env.OPERATIONS_DATABASE_URL = url.href;
    process.env.OPERATIONS_ENABLED = "true";
    process.env.OPERATIONS_METRIC_EXPORTS_ENABLED = "true";
    process.env.GROWTH_OS_OWNER_EMAIL = email;
    process.env.CRON_SECRET = "test-only-cron-secret";
    const id = await requestMetricExport(
      db,
      founder,
      { organisationId: randomUUID() },
      { accountId: "acct_metricWorker", mode: "test" },
    );
    assert.equal(
      (await GET(new Request("http://localhost/api/cron/operations-metrics")))
        .status,
      401,
    );
    const response = await GET(
      new Request("http://localhost/api/cron/operations-metrics", {
        headers: { authorization: "Bearer test-only-cron-secret" },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).processed, true);
    const download = createMetricExportHandler({
      enabled: true,
      origin: "http://localhost",
      founder: async () => founder,
      enqueue: async () => id,
      read: (actor, job, include) => readMetricExport(db, actor, job, include),
    });
    const csv = await download(
      new Request(`http://localhost/export?id=${id}&download=1`),
    );
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("cache-control") ?? "", /private, no-store/);
    assert.match(await csv.text(), /Definition version/);
  } finally {
    await getOperationsDb().end();
    for (const name of names) {
      if (old[name] === undefined) delete process.env[name];
      else process.env[name] = old[name];
    }
    await db.end();
    await admin.end();
  }
});
