import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { publishDailyOutreachSummary } from "../../../lib/growth/campaigns/daily-summary";

const url = process.env.OUTREACH_DAILY_TEST_URL;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 150));
test(
  "daily marker and audit are committed once, never on rollback or replay",
  { skip: !url },
  async () => {
    if (!url) return;
    const admin = postgres(url, { max: 1 });
    const app = postgres(url, {
      max: 3,
      connection: { options: "-c role=growth_app" },
    });
    const listen = postgres(url, {
      max: 1,
      connection: { options: "-c role=growth_app" },
    });
    let count = 0;
    let ownedDay: string | undefined;
    try {
      const [identity] = await admin<
        { database: string; day: string }[]
      >`select current_database() as database,(statement_timestamp() at time zone 'Europe/London')::date::text as day`;
      const [role] = await app<{ name: string }[]>`select current_user as name`;
      assert.equal(identity?.database, "fss_growth_test");
      assert.equal(role?.name, "growth_app");
      if (!identity) throw new Error("missing test identity");
      const correlation = `outreach-daily-summary:${identity.day}`;
      const [before] = await admin<
        { snapshots: number; audits: number }[]
      >`select (select count(*)::int from growth.daily_outreach_summaries where london_day=${identity.day}::date) as snapshots,(select count(*)::int from growth.audit_log where correlation_id=${correlation}) as audits`;
      assert.deepEqual(
        before,
        { snapshots: 0, audits: 0 },
        "fixture must be empty; will not remove pre-existing records",
      );
      ownedDay = identity.day;
      const listener = await listen.listen(
        "growth_daily_summary_changed",
        (payload) => {
          if (payload === "changed") count++;
        },
      );
      try {
        await assert.rejects(
          app.begin(async (tx) => {
            await publishDailyOutreachSummary(tx as unknown as GrowthDb);
            throw new Error("rollback");
          }),
          /rollback/,
        );
        await settle();
        assert.equal(count, 0);
        const [a, b] = await Promise.all([
          publishDailyOutreachSummary(app),
          publishDailyOutreachSummary(app),
        ]);
        assert.deepEqual(a, b);
        await settle();
        assert.equal(count, 1);
        await publishDailyOutreachSummary(app);
        await settle();
        assert.equal(count, 1);
        const [after] = await admin<
          { audits: number }[]
        >`select count(*)::int as audits from growth.audit_log where correlation_id=${correlation} and action='outreach_daily_summary.published'`;
        assert.equal(after?.audits, 1);
      } finally {
        await listener.unlisten();
      }
    } finally {
      if (ownedDay) {
        await admin`delete from growth.audit_log where correlation_id=${`outreach-daily-summary:${ownedDay}`} and action='outreach_daily_summary.published'`;
        await admin`delete from growth.daily_outreach_summaries where london_day=${ownedDay}::date`;
      }
      await Promise.all([admin.end(), app.end(), listen.end()]);
    }
  },
);
