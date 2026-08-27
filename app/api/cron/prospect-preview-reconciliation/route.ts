import { readGrowthServerEnv, requireProspectPreviewGenerationEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import {
  listOpenPreviewGenerationRecords,
  markPreviewGenerationMergedDraft,
} from "@/lib/growth/prospect-previews/composition-repository";
import { getMergedProspectPreviewCompositionByProspectId } from "@/lib/growth/prospect-previews/compositions/manifest";
import { getGitHubPreviewPullRequestState } from "@/lib/growth/prospect-previews/generation/github-preview-pr";
import { reconcileProspectPreviewGenerationRun } from "@/lib/growth/prospect-previews/generation/reconcile";

import { createProspectPreviewReconciliationRouteHandler } from "./handler";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: environment.cronSecret,
    previewPrEnabled: environment.previewPrEnabled,
    reconcile: async () => {
      const github = requireProspectPreviewGenerationEnv(environment);
      const db = getGrowthDb();

      return reconcileProspectPreviewGenerationRun({
        repository: {
          listOpenPreviews: () => listOpenPreviewGenerationRecords(db),
          markMergedDraft: (input) => markPreviewGenerationMergedDraft(input, db),
        },
        github: {
          getPullRequest: (number) =>
            getGitHubPreviewPullRequestState({ token: github.token, number }),
        },
        resolveComposition: getMergedProspectPreviewCompositionByProspectId,
      });
    },
    reportUnexpectedError: (error) => {
      console.error("Prospect preview reconciliation failed.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
