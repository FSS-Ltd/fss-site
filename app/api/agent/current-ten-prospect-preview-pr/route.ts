import { randomUUID } from "node:crypto";

import {
  readGrowthServerEnv,
  requireProspectPreviewGenerationEnv,
} from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import {
  listCurrentTenPreviewGenerationCandidates,
  markPreviewCompositionUnavailable,
  recordPreviewGenerationResult,
} from "@/lib/growth/prospect-previews/composition-repository";
import {
  classifyCurrentTenPreviewBackfillFailure,
  isCurrentTenPreviewBackfillRunId,
  runCurrentTenPreviewBackfill,
  type CurrentTenPreviewBackfillRepository,
} from "@/lib/growth/prospect-previews/generation/current-ten-backfill";
import {
  createGitHubPreviewPullRequest,
  type GitHubPreviewSourceFile,
} from "@/lib/growth/prospect-previews/generation/github-preview-pr";
import { createProspectPreviewPrPostHandler } from "@/lib/growth/prospect-previews/generation/route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

function createRepository(): CurrentTenPreviewBackfillRepository {
  const db = getGrowthDb();
  return {
    listEligibleExistingCandidates: () =>
      listCurrentTenPreviewGenerationCandidates(db),
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
    isAllowedExternalRunId: isCurrentTenPreviewBackfillRunId,
    run: (externalRunId) => {
      if (github === null) {
        throw new Error("Current-ten preview PR generation is disabled.");
      }
      return runCurrentTenPreviewBackfill({
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
            }),
        },
      });
    },
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Current-ten prospect preview pull-request generation failed.", {
        correlationId,
        failureCategory: classifyCurrentTenPreviewBackfillFailure(error),
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
