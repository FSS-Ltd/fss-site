import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import {
  getReviewableBespokePreviewSources,
  type ReviewableBespokePreviewSource,
} from "./reviewable-source";

const BRANCH_PATTERN = /^fix\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREVIEW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingBespokePreviewDraft = {
  previewId: string;
  prospectId: string;
  websiteHost: string;
};

export type BespokePreviewRelease = {
  branch: string;
  generatedAt: Date;
  pullRequestNumber: number;
};

export type BespokePreviewReconciliationResult = {
  previews: readonly {
    digest: string;
    prospectId: string;
    slug: string;
  }[];
  status: "applied" | "ready";
};

export type BespokePreviewReconciliationTransaction = {
  listPendingDrafts(): Promise<readonly PendingBespokePreviewDraft[]>;
  markMergedDraft(input: {
    compositionDigest: string;
    generatedAt: Date;
    generationBranch: string;
    generationExternalRunId: string;
    generationPrNumber: number;
    previewId: string;
    slug: string;
  }): Promise<boolean>;
};

export interface BespokePreviewReconciliationRepository {
  withTransaction<T>(
    operation: (
      transaction: BespokePreviewReconciliationTransaction,
    ) => Promise<T>,
  ): Promise<T>;
}

function validateRelease(release: BespokePreviewRelease): void {
  if (
    !Number.isInteger(release.pullRequestNumber) ||
    release.pullRequestNumber < 1 ||
    !BRANCH_PATTERN.test(release.branch) ||
    Number.isNaN(release.generatedAt.getTime())
  ) {
    throw new TypeError("Bespoke preview release metadata is invalid.");
  }
}

function resolveExpectedPreviews(
  rows: readonly PendingBespokePreviewDraft[],
): readonly {
  preview: PendingBespokePreviewDraft;
  source: ReviewableBespokePreviewSource;
}[] {
  const sourcesByHost = new Map(
    getReviewableBespokePreviewSources().map((source) => [
      source.websiteHost,
      source,
    ]),
  );
  const expectedRows = rows.filter((row) => sourcesByHost.has(row.websiteHost));
  const seenHosts = new Set<string>();
  for (const preview of expectedRows) {
    if (seenHosts.has(preview.websiteHost)) {
      throw new Error("Duplicate pending bespoke preview host.");
    }
    seenHosts.add(preview.websiteHost);
  }
  if (expectedRows.length !== sourcesByHost.size) {
    throw new Error("Expected six pending bespoke preview drafts.");
  }

  return expectedRows.map((preview) => {
    if (
      !PREVIEW_ID_PATTERN.test(preview.previewId) ||
      !PREVIEW_ID_PATTERN.test(preview.prospectId)
    ) {
      throw new Error("Pending bespoke preview identity is invalid.");
    }

    const source = sourcesByHost.get(preview.websiteHost);
    if (!source) throw new Error("Pending bespoke preview source is unknown.");
    return { preview, source };
  });
}

export async function reconcileBespokeProspectPreviews(input: {
  apply: boolean;
  release: BespokePreviewRelease;
  repository: BespokePreviewReconciliationRepository;
}): Promise<BespokePreviewReconciliationResult> {
  validateRelease(input.release);

  return input.repository.withTransaction(async (transaction) => {
    const previews = resolveExpectedPreviews(
      await transaction.listPendingDrafts(),
    );
    if (input.apply) {
      for (const { preview, source } of previews) {
        const updated = await transaction.markMergedDraft({
          compositionDigest: source.digest,
          generatedAt: input.release.generatedAt,
          generationBranch: input.release.branch,
          generationExternalRunId: `bespoke-release-pr-${input.release.pullRequestNumber}`,
          generationPrNumber: input.release.pullRequestNumber,
          previewId: preview.previewId,
          slug: source.slug,
        });
        if (!updated) {
          throw new Error(
            "Bespoke preview state changed before reconciliation.",
          );
        }
      }
    }

    return {
      previews: previews.map(({ preview, source }) => ({
        digest: source.digest,
        prospectId: preview.prospectId,
        slug: source.slug,
      })),
      status: input.apply ? "applied" : "ready",
    };
  });
}

function normaliseWebsiteHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function createPostgresBespokePreviewReconciliationRepository(
  db: GrowthDb,
): BespokePreviewReconciliationRepository {
  return {
    withTransaction(operation) {
      return withGrowthTransaction(db, async (transaction) =>
        operation({
          async listPendingDrafts() {
            const rows = await transaction<
              Array<{
                previewId: string;
                prospectId: string;
                websiteUrl: string | null;
              }>
            >`
              select
                pp.id as "previewId",
                pp.prospect_id as "prospectId",
                b.website_url as "websiteUrl"
              from growth.prospect_previews pp
              inner join growth.prospects p on p.id = pp.prospect_id
              inner join growth.businesses b on b.id = p.business_id
              where pp.status = 'draft'
                and pp.generation_status = 'pending_pr'
              for update of pp
            `;

            return rows.flatMap((row) => {
              const websiteHost = normaliseWebsiteHost(row.websiteUrl);
              return websiteHost === null
                ? []
                : [
                    {
                      previewId: row.previewId,
                      prospectId: row.prospectId,
                      websiteHost,
                    },
                  ];
            });
          },
          async markMergedDraft(input) {
            const rows = await transaction<Array<{ id: string }>>`
              update growth.prospect_previews
              set slug = ${input.slug},
                  composition_digest = ${input.compositionDigest},
                  generation_status = 'merged_draft',
                  generation_pr_number = ${input.generationPrNumber},
                  generation_branch = ${input.generationBranch},
                  generation_external_run_id = ${input.generationExternalRunId},
                  generated_at = ${input.generatedAt},
                  updated_at = now()
              where id = ${input.previewId}
                and status = 'draft'
                and generation_status = 'pending_pr'
              returning id
            `;
            return rows.length === 1;
          },
        }),
      );
    },
  };
}
