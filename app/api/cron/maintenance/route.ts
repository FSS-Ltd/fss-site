import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import { readGrowthServerEnv } from "@/lib/growth/config/env";

import { createMaintenanceRouteHandler } from "./handler";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const env = readGrowthServerEnv();

  const handler = createMaintenanceRouteHandler({
    cronSecret: env.cronSecret,
    automationsEnabled: env.automationsEnabled,
    buildReport: async () => ({
      integrations: await getIntegrationHealthSummary(),
    }),
    reportUnexpectedError: (error) => {
      console.error("Growth OS maintenance cron failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
