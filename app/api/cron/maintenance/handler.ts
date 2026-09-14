import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";
import {
  createCronRouteHandler,
  type CronErrorReport,
} from "@/lib/growth/http/cron-auth";

export type MaintenanceReport = {
  integrations: readonly IntegrationHealth[];
};

export type MaintenanceRouteDependencies = {
  cronSecret: string | undefined;
  automationsEnabled: boolean;
  buildReport: () => Promise<MaintenanceReport>;
  reportUnexpectedError?: (report: CronErrorReport) => void;
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
