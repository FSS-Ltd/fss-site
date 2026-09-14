import {
  createCronRouteHandler,
  type CronErrorReport,
} from "@/lib/growth/http/cron-auth";
import type { ProspectPreviewGenerationReconciliationResult } from "@/lib/growth/prospect-previews/generation/reconcile";

export type ProspectPreviewReconciliationRouteDependencies = {
  cronSecret: string | undefined;
  previewPrEnabled: boolean;
  reconcile: () => Promise<ProspectPreviewGenerationReconciliationResult>;
  reportUnexpectedError?: (report: CronErrorReport) => void;
};

export function createProspectPreviewReconciliationRouteHandler(
  dependencies: ProspectPreviewReconciliationRouteDependencies,
): (request: Request) => Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: dependencies.cronSecret,
      automationsEnabled: dependencies.previewPrEnabled,
      disabledReason: "preview_pr_generation_disabled",
      reportUnexpectedError: dependencies.reportUnexpectedError,
    },
    async () => ({ reconciliation: await dependencies.reconcile() }),
  );
}
