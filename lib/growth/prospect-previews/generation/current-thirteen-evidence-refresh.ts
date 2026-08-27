import type { PreviewGenerationCandidate } from "../composition-repository";
import {
  createProspectPreviewPrRun,
  type CreateProspectPreviewPrRunInput,
  type ProspectPreviewPrGenerationRepository,
  type ProspectPreviewPrGitHubClient,
  type ProspectPreviewPrRunResult,
} from "./orchestrator";

const CURRENT_THIRTEEN_EVIDENCE_REFRESH_RUN_ID_PATTERN =
  /^evidence-refresh-thirteen-\d{4}-\d{2}-\d{2}$/;
const MINIMUM_CANDIDATE_COUNT = 1;
const MAXIMUM_CANDIDATE_COUNT = 13;
const CANDIDATE_COUNT_ERROR =
  "Current evidence refresh requires between one and thirteen eligible drafts.";

export function isCurrentThirteenEvidenceRefreshRunId(
  externalRunId: string,
): boolean {
  return CURRENT_THIRTEEN_EVIDENCE_REFRESH_RUN_ID_PATTERN.test(externalRunId);
}

export interface CurrentThirteenEvidenceRefreshRepository
  extends Omit<ProspectPreviewPrGenerationRepository, "listGenerationCandidates"> {
  listEligibleEvidenceCandidates(): Promise<readonly PreviewGenerationCandidate[]>;
}

export type RunCurrentThirteenEvidenceRefreshInput = {
  externalRunId: string;
  now: CreateProspectPreviewPrRunInput["now"];
  repository: CurrentThirteenEvidenceRefreshRepository;
  github: ProspectPreviewPrGitHubClient;
};

export async function runCurrentThirteenEvidenceRefresh(
  input: RunCurrentThirteenEvidenceRefreshInput,
): Promise<ProspectPreviewPrRunResult> {
  if (!isCurrentThirteenEvidenceRefreshRunId(input.externalRunId)) {
    throw new TypeError("Current thirteen-draft evidence refresh run ID is invalid.");
  }

  const candidates = await input.repository.listEligibleEvidenceCandidates();
  if (
    candidates.length < MINIMUM_CANDIDATE_COUNT ||
    candidates.length > MAXIMUM_CANDIDATE_COUNT
  ) {
    throw new Error(CANDIDATE_COUNT_ERROR);
  }

  return createProspectPreviewPrRun({
    externalRunId: input.externalRunId,
    now: input.now,
    branchSuffix: "evidence-refresh",
    replaceExistingSlugs: true,
    repository: {
      listGenerationCandidates: async (externalRunId) => {
        if (externalRunId !== input.externalRunId) {
          throw new Error("Current thirteen-draft evidence refresh run ID changed.");
        }
        return candidates;
      },
      markCompositionUnavailable: input.repository.markCompositionUnavailable,
      recordOpenPullRequest: input.repository.recordOpenPullRequest,
    },
    github: input.github,
  });
}
