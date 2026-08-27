import { randomUUID } from "node:crypto";

import {
  readGrowthServerEnv,
  requireProspectPreviewGenerationEnv,
} from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import { verifyAgentRequest } from "@/lib/growth/integrations/agent-signature";
import {
  listPreviewGenerationCandidates,
  markPreviewCompositionUnavailable,
  recordPreviewGenerationResult,
} from "@/lib/growth/prospect-previews/composition-repository";
import {
  createGitHubPreviewPullRequest,
  type GitHubPreviewSourceFile,
} from "@/lib/growth/prospect-previews/generation/github-preview-pr";
import {
  createProspectPreviewPrRun,
  type ProspectPreviewPrGenerationRepository,
} from "@/lib/growth/prospect-previews/generation/orchestrator";
import { createProspectPreviewPrPostHandler } from "@/lib/growth/prospect-previews/generation/route-handler";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

function createRepository(): ProspectPreviewPrGenerationRepository {
  const db = getGrowthDb();
  return {
    listGenerationCandidates: (externalRunId) =>
      listPreviewGenerationCandidates(externalRunId, db),
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
  const github = environment.previewPrEnabled
    ? requireProspectPreviewGenerationEnv(environment)
    : null;
  const handler = createProspectPreviewPrPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    enabled: environment.previewPrEnabled,
    createCorrelationId: randomUUID,
    now: () => new Date(),
    verifyRequest: verifyAgentRequest,
    run: (externalRunId) => {
      if (github === null) {
        throw new Error("Preview PR generation is disabled.");
      }
      return createProspectPreviewPrRun({
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
      console.error("Prospect preview pull-request generation failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}
