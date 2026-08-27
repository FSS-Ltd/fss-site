export type OpenProspectPreviewGeneration = {
  previewId: string;
  prospectId: string;
  compositionDigest: string;
  pullRequestNumber: number;
};

export interface ProspectPreviewGenerationReconciliationRepository {
  listOpenPreviews(): Promise<readonly OpenProspectPreviewGeneration[]>;
  markMergedDraft(input: {
    previewId: string;
    compositionDigest: string;
  }): Promise<boolean>;
}

export interface ProspectPreviewGenerationReconciliationGitHub {
  getPullRequest(number: number): Promise<{
    number: number;
    state: "open" | "closed";
    mergedAt: Date | null;
  }>;
}

export type ProspectPreviewGenerationReconciliationResult = {
  merged: number;
  waiting: number;
  closed: number;
  invalid: number;
};

export async function reconcileProspectPreviewGenerationRun(input: {
  repository: ProspectPreviewGenerationReconciliationRepository;
  github: ProspectPreviewGenerationReconciliationGitHub;
  resolveComposition: (
    prospectId: string,
  ) => { prospectId: string; digest: string } | null;
}): Promise<ProspectPreviewGenerationReconciliationResult> {
  const result: ProspectPreviewGenerationReconciliationResult = {
    merged: 0,
    waiting: 0,
    closed: 0,
    invalid: 0,
  };
  const records = await input.repository.listOpenPreviews();

  for (const record of records) {
    const pullRequest = await input.github.getPullRequest(
      record.pullRequestNumber,
    );
    if (pullRequest.mergedAt === null) {
      if (pullRequest.state === "open") result.waiting += 1;
      else result.closed += 1;
      continue;
    }

    const composition = input.resolveComposition(record.prospectId);
    if (
      composition === null ||
      composition.prospectId !== record.prospectId ||
      composition.digest !== record.compositionDigest
    ) {
      result.invalid += 1;
      continue;
    }

    const updated = await input.repository.markMergedDraft({
      previewId: record.previewId,
      compositionDigest: record.compositionDigest,
    });
    if (!updated) {
      throw new Error("Preview generation state changed before merge reconciliation.");
    }
    result.merged += 1;
  }

  return result;
}
