import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { getOperationsDb } from "@/lib/operations/db/client";
import { runNextMetricExport } from "@/lib/operations/metrics/export-worker";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request): Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: process.env.CRON_SECRET,
      automationsEnabled:
        process.env.OPERATIONS_ENABLED === "true" &&
        process.env.OPERATIONS_METRIC_EXPORTS_ENABLED === "true",
      disabledReason: "operations_metric_exports_disabled",
      reportUnexpectedError: () =>
        process.stderr.write("Operations export worker failed.\n"),
    },
    async () => ({
      processed: await runNextMetricExport(
        getOperationsDb(),
        process.env.GROWTH_OS_OWNER_EMAIL ?? "",
      ),
    }),
  )(request);
}
