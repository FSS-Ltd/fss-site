import {
  readGrowthServerEnv,
  requireProspectPreviewGenerationEnv,
} from "../lib/growth/config/env";
import { createGrowthDb } from "../lib/growth/db/client";
import {
  listCurrentTenPreviewGenerationCandidates,
  markPreviewCompositionUnavailable,
  recordPreviewGenerationResult,
} from "../lib/growth/prospect-previews/composition-repository";
import { runCurrentTenPreviewBackfill } from "../lib/growth/prospect-previews/generation/current-ten-backfill";
import { createGitHubPreviewPullRequest } from "../lib/growth/prospect-previews/generation/github-preview-pr";

function readRunId(argumentsList: readonly string[]): string {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--run-id") {
    throw new Error("Usage: pnpm growth:previews:backfill-pr -- --run-id current-ten-YYYY-MM-DD");
  }
  const runId = argumentsList[1];
  if (!runId || !/^current-ten-\d{4}-\d{2}-\d{2}$/.test(runId)) {
    throw new Error("Current-ten preview backfill run ID is invalid.");
  }
  return runId;
}

async function main(): Promise<void> {
  const externalRunId = readRunId(process.argv.slice(2));
  const environment = readGrowthServerEnv();
  const github = requireProspectPreviewGenerationEnv(environment);
  const db = createGrowthDb(environment.databaseUrl);

  try {
    const result = await runCurrentTenPreviewBackfill({
      externalRunId,
      now: () => new Date(),
      repository: {
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
      },
      github: {
        createPullRequest: (input) =>
          createGitHubPreviewPullRequest({
            token: github.token,
            branch: input.branch,
            title: input.title,
            body: input.body,
            files: input.files,
          }),
      },
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

void main().catch(() => {
  process.stderr.write("Prospect preview source backfill failed.\n");
  process.exitCode = 1;
});
