import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { runMonthlyReportBatch } from "../../../lib/growth/campaigns/monthly-report-worker";
import { seedMonthlyReport } from "./monthly-report-fixture";

const url = process.env.DIRECT_DATABASE_URL;
test(
  "claims at most five, publishes once, and recovers an expired lease",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 2,
      connection: { options: "-c role=growth_app" },
    });
    const fixtures: Awaited<ReturnType<typeof seedMonthlyReport>>[] = [];
    try {
      for (let i = 0; i < 6; i++) {
        const fixture = await seedMonthlyReport(
          admin,
          `report-${i}@example.test`,
        );
        fixtures.push(fixture);
        await admin`update growth.outreach_jobs set lease_until=clock_timestamp()-interval '1 minute' where id=${fixture.jobId}`;
      }
      await admin`update growth.outreach_jobs set lease_revision=10 where id=${fixtures[0]!.jobId}`;
      const first = await runMonthlyReportBatch(db);
      assert.deepEqual(first, { claimed: 5, published: 5, held: 0, retry: 0 });
      const [deferred] = await admin<
        { revision: string }[]
      >`select lease_revision::text as revision from growth.outreach_jobs where id=${fixtures[0]!.jobId}`;
      assert.equal(deferred?.revision, "10");
      const second = await runMonthlyReportBatch(db);
      assert.deepEqual(second, { claimed: 1, published: 1, held: 0, retry: 0 });
      assert.deepEqual(await runMonthlyReportBatch(db), {
        claimed: 0,
        published: 0,
        held: 0,
        retry: 0,
      });
      const ids = fixtures.map((fixture) => fixture.jobId);
      const [row] = await admin<
        { count: number }[]
      >`select count(*)::int as count from growth.experiment_reviews where report_job_id in ${admin(ids)}`;
      assert.equal(row?.count, 6);
    } finally {
      for (const fixture of fixtures) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);

test(
  "concurrent workers hold invalid evidence once and leave future jobs untouched",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const db = postgres(url, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const fixtures: Awaited<ReturnType<typeof seedMonthlyReport>>[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        fixtures.push(await seedMonthlyReport(admin, `held-${i}@example.test`));
      }
      const [invalid, ready, future] = fixtures;
      await admin`update growth.outreach_jobs set lease_until=clock_timestamp()-interval '1 minute',due_at=due_at-interval '1 day' where id=${invalid!.jobId}`;
      await admin`update growth.outreach_jobs set lease_until=clock_timestamp()-interval '1 minute' where id=${ready!.jobId}`;
      await admin`update growth.outreach_jobs set lease_until=clock_timestamp()-interval '1 minute',due_at=clock_timestamp()+interval '1 day' where id=${future!.jobId}`;
      const results = await Promise.all([
        runMonthlyReportBatch(db),
        runMonthlyReportBatch(db),
      ]);
      assert.equal(
        results.reduce((total, result) => total + result.claimed, 0),
        2,
      );
      assert.equal(
        results.reduce((total, result) => total + result.published, 0),
        1,
      );
      assert.equal(
        results.reduce((total, result) => total + result.held, 0),
        1,
      );
      const [held] = await admin<
        { status: string; reason: string }[]
      >`select status,last_error_code as reason from growth.outreach_jobs where id=${invalid!.jobId}`;
      assert.deepEqual(held, { status: "held", reason: "job_lease_invalid" });
      const [untouched] = await admin<
        { revision: string }[]
      >`select lease_revision::text as revision from growth.outreach_jobs where id=${future!.jobId}`;
      assert.equal(untouched?.revision, "1");
      assert.equal((await runMonthlyReportBatch(db)).claimed, 0);
    } finally {
      for (const fixture of fixtures) await fixture.cleanup();
      await db.end();
      await admin.end();
    }
  },
);
