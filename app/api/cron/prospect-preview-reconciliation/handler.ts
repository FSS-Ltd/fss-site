import { createCronRouteHandler } from "@/lib/growth/http/cron-auth";
import type { ProspectPreviewGenerationReconciliationResult } from "@/lib/growth/prospect-previews/generation/reconcile";

export type ProspectPreviewReconciliationRouteDependencies = {
  cronSecret: string | undefined;
  automationsEnabled: boolean;
  previewPrEnabled: boolean;
  reconcile: () => Promise<ProspectPreviewGenerationReconciliationResult>;
  reportUnexpectedError?: (error: unknown) => void;
};

export function createProspectPreviewReconciliationRouteHandler(
  dependencies: ProspectPreviewReconciliationRouteDependencies,
): (request: Request) => Promise<Response> {
  return createCronRouteHandler(
    {
      cronSecret: dependencies.cronSecret,
      automationsEnabled: dependencies.automationsEnabled,
      reportUnexpectedError: dependencies.reportUnexpectedError,
    },
    async () => {
      if (!dependencies.previewPrEnabled) {
        return { skipped: "preview_pr_generation_disabled" };
      }

      return { reconciliation: await dependencies.reconcile() };
    },
  );
}
