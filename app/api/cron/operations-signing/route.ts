import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import { getGrowthDb } from "@/lib/growth/db/client";
import {
  getSigningWorkerDb,
  runSigningCompletionWorker,
  signingEnabled,
} from "@/lib/operations/agreements/signing-worker";
import { runSigningGrowthWorker } from "@/lib/operations/agreements/signing-growth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request): Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: process.env.CRON_SECRET,
      automationsEnabled: signingEnabled(),
      disabledReason: "operations_signing_disabled",
      reportUnexpectedError: (report) =>
        console.error("Operations signing completion failed.", report),
    },
    async () => {
      const db = getSigningWorkerDb();
      const signatures = await runSigningCompletionWorker(db, { limit: 5 });
      const growth = await runSigningGrowthWorker(db, getGrowthDb(), {
        limit: 5,
      });
      return { signatures, growth };
    },
  )(request);
}
