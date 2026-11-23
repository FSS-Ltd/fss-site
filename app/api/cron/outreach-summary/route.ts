import { getGrowthDb } from "@/lib/growth/db/client";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { isLondonSummarySlot } from "@/lib/growth/campaigns/daily-runs";
import { runMonthlyReportBatch } from "@/lib/growth/campaigns/monthly-report-worker";
import { readCronEnv } from "../runtime";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readCronEnv();
  return createCronRouteHandler(
    {
      cronSecret: env.cronSecret,
      automationsEnabled: env.automationsEnabled,
      reportUnexpectedError: (report) =>
        console.error("Growth OS outreach-summary cron failed.", report),
    },
    async () => {
      if (process.env.GROWTH_OS_OUTREACH_SUMMARY_ENABLED !== "true")
        return { skipped: "outreach_summary_disabled" };
      if (!isLondonSummarySlot(new Date()))
        return { skipped: "outside_summary_slot" };
      return { reports: await runMonthlyReportBatch(getGrowthDb()) };
    },
  )(request);
}
