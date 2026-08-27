import { randomUUID } from "node:crypto";

import {
  readGrowthServerEnv,
  requireProspectPreviewGenerationEnv,
} from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import {
  listCurrentThirteenEvidenceRefreshCandidates,
  markPreviewCompositionUnavailable,
  recordPreviewGenerationResult,
} from "@/lib/growth/prospect-previews/composition-repository";
import {
  isCurrentThirteenEvidenceRefreshRunId,
  runCurrentThirteenEvidenceRefresh,
  type CurrentThirteenEvidenceRefreshRepository,
} from "@/lib/growth/prospect-previews/generation/current-thirteen-evidence-refresh";
import {
  createGitHubPreviewPullRequest,
  type GitHubPreviewSourceFile,
} from "@/lib/growth/prospect-previews/generation/github-preview-pr";
import { createProspectPreviewPrPostHandler } from "@/lib/growth/prospect-previews/generation/route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

function createRepository(): CurrentThirteenEvidenceRefreshRepository {
  const db = getGrowthDb();
  return {
    listEligibleEvidenceCandidates: () =>
      listCurrentThirteenEvidenceRefreshCandidates(db),
    markCompositionUnavailable: (input) =>
      markPreviewCompositionUnavailable(
        {
          prospectId: input.prospectId,
          generationExternalRunId: input.externalRunId,
          generatedAt: input.generatedAt,
        },
        db,
      ),
    recordOpenPullRequest: (input) =>
      recordPreviewGenerationResult(
        {
          prospectId: input.prospectId,
          slug: input.slug,
          compositionDigest: input.compositionDigest,
          generationPrNumber: input.pullRequestNumber,
          generationBranch: input.branch,
          reviewDeploymentUrl: null,
          generationExternalRunId: input.externalRunId,
          generatedAt: input.generatedAt,
        },
        db,
      ),
  };
}

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const enabled =
    process.env.VERCEL_ENV === "production" && environment.previewPrEnabled;
  const github = enabled
    ? requireProspectPreviewGenerationEnv(environment)
    : null;
  const handler = createProspectPreviewPrPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    enabled,
    createCorrelationId: randomUUID,
    now: () => new Date(),
    verifyRequest: verifyAgentRequest,
    isAllowedExternalRunId: isCurrentThirteenEvidenceRefreshRunId,
    run: (externalRunId) => {
      if (github === null) {
        throw new Error("Current thirteen-draft evidence refresh is disabled.");
      }
      return runCurrentThirteenEvidenceRefresh({
        externalRunId,
        now: () => new Date(),
        repository: createRepository(),
        github: {
          createPullRequest: (input) =>
            createGitHubPreviewPullRequest({
              token: github.token,
              branch: input.branch,
              title: input.title,
              body: input.body,
              files: input.files satisfies readonly GitHubPreviewSourceFile[],
              replaceExistingSlugs: input.replaceExistingSlugs,
            }),
        },
      });
    },
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Current thirteen-draft evidence refresh failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
