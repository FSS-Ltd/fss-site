import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";
import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";

export const runtime = "nodejs";

export type MaintenanceReport = {
  integrations: readonly IntegrationHealth[];
};

export type MaintenanceRouteDependencies = {
  cronSecret: string | undefined;
  automationsEnabled: boolean;
  buildReport: () => Promise<MaintenanceReport>;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createMaintenanceRouteHandler(
  dependencies: MaintenanceRouteDependencies,
): (request: Request) => Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: dependencies.cronSecret,
      automationsEnabled: dependencies.automationsEnabled,
      reportUnexpectedError: dependencies.reportUnexpectedError,
    },
    async () => ({ report: await dependencies.buildReport() }),
  );
}

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
