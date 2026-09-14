import type { GrowthDb } from "@/lib/growth/db/types";
import {
  createCronRouteHandler,
  type CronErrorReport,
} from "@/lib/growth/http/cron-auth";
import type { NewsletterDispatchSummary } from "@/lib/growth/newsletter/dispatch";

export type ResendDispatchRouteDependencies = {
  db: GrowthDb;
  cronSecret: string | undefined;
  automationsEnabled: boolean;
  dispatch: (db: GrowthDb) => Promise<NewsletterDispatchSummary>;
  reportUnexpectedError?: (report: CronErrorReport) => void;
};

export function createResendDispatchRouteHandler(
  dependencies: ResendDispatchRouteDependencies,
): (request: Request) => Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: dependencies.cronSecret,
      automationsEnabled: dependencies.automationsEnabled,
      reportUnexpectedError: dependencies.reportUnexpectedError,
    },
    async () => ({ dispatch: await dependencies.dispatch(dependencies.db) }),
  );
}
