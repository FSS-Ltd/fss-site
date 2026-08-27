import type { PreviewGenerationCandidate } from "../composition-repository";
import {
  createProspectPreviewPrRun,
  type CreateProspectPreviewPrRunInput,
  type ProspectPreviewPrGenerationRepository,
  type ProspectPreviewPrGitHubClient,
  type ProspectPreviewPrRunResult,
} from "./orchestrator";

const CURRENT_TEN_RUN_ID_PATTERN = /^current-ten-\d{4}-\d{2}-\d{2}$/;

export function isCurrentTenPreviewBackfillRunId(externalRunId: string): boolean {
  return CURRENT_TEN_RUN_ID_PATTERN.test(externalRunId);
}

export interface CurrentTenPreviewBackfillRepository
  extends Omit<ProspectPreviewPrGenerationRepository, "listGenerationCandidates"> {
  listEligibleExistingCandidates(): Promise<readonly PreviewGenerationCandidate[]>;
}

export type RunCurrentTenPreviewBackfillInput = {
  externalRunId: string;
  now: CreateProspectPreviewPrRunInput["now"];
  repository: CurrentTenPreviewBackfillRepository;
  github: ProspectPreviewPrGitHubClient;
};

export async function runCurrentTenPreviewBackfill(
  input: RunCurrentTenPreviewBackfillInput,
): Promise<ProspectPreviewPrRunResult> {
  if (!isCurrentTenPreviewBackfillRunId(input.externalRunId)) {
    throw new TypeError("Current-ten preview backfill run ID is invalid.");
  }

  const candidates = await input.repository.listEligibleExistingCandidates();
  if (candidates.length !== 10) {
    throw new Error("Current-ten preview backfill requires exactly ten eligible drafts.");
  }

  return createProspectPreviewPrRun({
    externalRunId: input.externalRunId,
    now: input.now,
    repository: {
      listGenerationCandidates: async (externalRunId) => {
        if (externalRunId !== input.externalRunId) {
          throw new Error("Current-ten preview backfill run ID changed.");
        }
        return candidates;
      },
      markCompositionUnavailable: input.repository.markCompositionUnavailable,
      recordOpenPullRequest: input.repository.recordOpenPullRequest,
    },
    github: input.github,
  });
}
