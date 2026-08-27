import type { PreviewGenerationCandidate } from "../composition-repository";
import type { GeneratedPreviewFile, GeneratedPreviewPackage } from "./generated-files";
import { buildGeneratedPreviewFiles } from "./generated-files";

const EXTERNAL_RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

export type ProspectPreviewPrRunStatus =
  | "created"
  | "existing"
  | "unavailable";

export type ProspectPreviewPrRunResult = {
  externalRunId: string;
  status: ProspectPreviewPrRunStatus;
  generated: number;
  unavailable: number;
  pullRequestNumber: number | null;
};

export type RecordOpenPullRequestInput = {
  prospectId: string;
  slug: string;
  compositionDigest: string;
  pullRequestNumber: number;
  branch: string;
  externalRunId: string;
  generatedAt: Date;
};

export type MarkCompositionUnavailableInput = {
  prospectId: string;
  externalRunId: string;
  generatedAt: Date;
};

export interface ProspectPreviewPrGenerationRepository {
  listGenerationCandidates(
    externalRunId: string,
  ): Promise<readonly PreviewGenerationCandidate[]>;
  markCompositionUnavailable(
    input: MarkCompositionUnavailableInput,
  ): Promise<boolean>;
  recordOpenPullRequest(input: RecordOpenPullRequestInput): Promise<boolean>;
}

export interface ProspectPreviewPrGitHubClient {
  createPullRequest(input: {
    branch: string;
    title: string;
    body: string;
    files: readonly GeneratedPreviewFile[];
    replaceExistingSlugs: boolean;
  }): Promise<{
    number: number;
    url: string;
    alreadyOpen: boolean;
  }>;
}

export type CreateProspectPreviewPrRunInput = {
  externalRunId: string;
  now: () => Date;
  repository: ProspectPreviewPrGenerationRepository;
  github: ProspectPreviewPrGitHubClient;
  branchSuffix?: "evidence-refresh";
  replaceExistingSlugs?: boolean;
};

function formatLondonDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Preview generation time is invalid.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (!year || !month || !day) {
    throw new Error("Preview generation date formatting failed.");
  }
  return `${year}-${month}-${day}`;
}

function validateExternalRunId(externalRunId: string): void {
  if (
    !EXTERNAL_RUN_ID_PATTERN.test(externalRunId) ||
    externalRunId !== externalRunId.trim()
  ) {
    throw new TypeError("Preview generation run ID is invalid.");
  }
}

function buildPullRequestTitle(input: {
  date: string;
  replaceExistingSlugs: boolean;
}): string {
  return input.replaceExistingSlugs
    ? `feat: refresh prospect previews for ${input.date}`
    : `feat: add prospect previews for ${input.date}`;
}

function buildPullRequestBody(input: {
  generated: number;
  unavailable: number;
  replaceExistingSlugs: boolean;
}): string {
  return [
    input.replaceExistingSlugs
      ? "Review replacement prospect preview compositions generated from evidence-backed Growth OS snapshots."
      : "Review deterministic prospect preview compositions generated from sanitized Growth OS snapshots.",
    "",
    `Generated packages: ${input.generated}`,
    `Unavailable candidates: ${input.unavailable}`,
    "",
    "This pull request does not publish previews or alter email.",
  ].join("\n");
}

function validateGenerationMode(input: CreateProspectPreviewPrRunInput): void {
  if (
    input.replaceExistingSlugs === true &&
    input.branchSuffix !== "evidence-refresh"
  ) {
    throw new TypeError(
      "Preview replacement generation requires the evidence refresh branch.",
    );
  }
  if (
    input.branchSuffix !== undefined &&
    input.branchSuffix !== "evidence-refresh"
  ) {
    throw new TypeError("Preview generation branch suffix is invalid.");
  }
}

async function recordUnavailablePackages(
  input: Pick<
    CreateProspectPreviewPrRunInput,
    "externalRunId" | "repository"
  > & {
    generatedAt: Date;
    prospectIds: readonly string[];
  },
): Promise<void> {
  for (const prospectId of input.prospectIds) {
    const updated = await input.repository.markCompositionUnavailable({
      prospectId,
      externalRunId: input.externalRunId,
      generatedAt: input.generatedAt,
    });
    if (!updated) {
      throw new Error("Preview generation state changed before unavailability was recorded.");
    }
  }
}

async function recordOpenPackages(
  input: Pick<
    CreateProspectPreviewPrRunInput,
    "externalRunId" | "repository"
  > & {
    generatedAt: Date;
    branch: string;
    pullRequestNumber: number;
    packages: readonly GeneratedPreviewPackage[];
  },
): Promise<void> {
  for (const previewPackage of input.packages) {
    const updated = await input.repository.recordOpenPullRequest({
      prospectId: previewPackage.prospectId,
      slug: previewPackage.slug,
      compositionDigest: previewPackage.composition.digest,
      pullRequestNumber: input.pullRequestNumber,
      branch: input.branch,
      externalRunId: input.externalRunId,
      generatedAt: input.generatedAt,
    });
    if (!updated) {
      throw new Error("Preview generation state changed before the pull request was recorded.");
    }
  }
}

export async function createProspectPreviewPrRun(
  input: CreateProspectPreviewPrRunInput,
): Promise<ProspectPreviewPrRunResult> {
  validateExternalRunId(input.externalRunId);
  validateGenerationMode(input);
  const generatedAt = input.now();
  const date = formatLondonDate(generatedAt);
  const candidates = await input.repository.listGenerationCandidates(
    input.externalRunId,
  );
  const generated = buildGeneratedPreviewFiles(candidates);

  await recordUnavailablePackages({
    externalRunId: input.externalRunId,
    repository: input.repository,
    generatedAt,
    prospectIds: generated.unavailable.map((entry) => entry.prospectId),
  });

  if (generated.packages.length === 0) {
    return {
      externalRunId: input.externalRunId,
      status: "unavailable",
      generated: 0,
      unavailable: generated.unavailable.length,
      pullRequestNumber: null,
    };
  }

  const branch = `generated/prospect-previews/${date}${
    input.branchSuffix === undefined ? "" : `-${input.branchSuffix}`
  }`;
  const replaceExistingSlugs = input.replaceExistingSlugs === true;
  const pullRequest = await input.github.createPullRequest({
    branch,
    title: buildPullRequestTitle({ date, replaceExistingSlugs }),
    body: buildPullRequestBody({
      generated: generated.packages.length,
      unavailable: generated.unavailable.length,
      replaceExistingSlugs,
    }),
    files: generated.files,
    replaceExistingSlugs,
  });

  await recordOpenPackages({
    externalRunId: input.externalRunId,
    repository: input.repository,
    generatedAt,
    branch,
    pullRequestNumber: pullRequest.number,
    packages: generated.packages,
  });

  return {
    externalRunId: input.externalRunId,
    status: pullRequest.alreadyOpen ? "existing" : "created",
    generated: generated.packages.length,
    unavailable: generated.unavailable.length,
    pullRequestNumber: pullRequest.number,
  };
}
