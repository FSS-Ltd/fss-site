import { requireFounder } from "@/lib/growth/auth/require-founder";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { createMetricExportHandler } from "@/lib/operations/metrics/export-handler";
import {
  requestMetricExport,
  readMetricExport,
} from "@/lib/operations/metrics/export-repository";
import { retiredGrowthOperationsResponse } from "@/lib/operations/auth/legacy-growth-route";
export const dynamic = "force-dynamic";
async function handle(request: Request): Promise<Response> {
  const retired = retiredGrowthOperationsResponse();
  if (retired) return retired;
  return createMetricExportHandler({
    enabled:
      operationsEnabled() &&
      process.env.OPERATIONS_METRIC_EXPORTS_ENABLED === "true",
    origin: new URL(resolveSiteUrl()).origin,
    founder: requireFounder,
    enqueue: async (founder, filters) => {
      const mode = process.env.STRIPE_MODE,
        accountId = process.env.STRIPE_ACCOUNT_ID;
      if (
        process.env.OPERATIONS_BILLING_ENABLED !== "true" ||
        !accountId ||
        (mode !== "test" && mode !== "live")
      )
        throw new Error("Billing unavailable.");
      return requestMetricExport(getOperationsDb(), founder, filters, {
        accountId,
        mode,
      });
    },
    read: (founder, id, download) =>
      readMetricExport(getOperationsDb(), founder, id, download),
  })(request);
}
export const POST = handle;
export const GET = handle;
