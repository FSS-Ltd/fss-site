import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  parseStoredProspectPreviewSnapshot,
  type StoredProspectPreviewSnapshot,
} from "./types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPOSITION_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_PATTERN =
  /^generated\/prospect-previews\/\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+)*$/;

export type PreviewGenerationCandidate = {
  previewId: string;
  prospectId: string;
  snapshot: StoredProspectPreviewSnapshot;
};

export type CurrentTenPreviewGenerationStates = {
  pendingPr: number;
  prOpen: number;
  mergedDraft: number;
  compositionUnavailable: number;
  published: number;
  withdrawn: number;
};

export type CurrentTenUnavailableSectorCount = {
  sector: string;
  count: number;
};

export type CurrentTenPreviewGenerationInventory = {
  activeDrafts: number;
  assessedDrafts: number;
  pendingAssessedDrafts: number;
  eligibleDrafts: number;
  generationStates: CurrentTenPreviewGenerationStates;
  unavailableSectors: readonly CurrentTenUnavailableSectorCount[];
};

export type RequeueCurrentTenUnavailablePreviewCompositionsResult = {
  requeued: number;
};

export type OpenPreviewGenerationRecord = {
  previewId: string;
  prospectId: string;
  compositionDigest: string;
  pullRequestNumber: number;
};

export type RecordPreviewGenerationResultInput = {
  prospectId: string;
  slug: string;
  compositionDigest: string;
  generationPrNumber: number;
  generationBranch: string;
  reviewDeploymentUrl: string | null;
  generationExternalRunId: string;
  generatedAt: Date;
};

export type MarkPreviewCompositionUnavailableInput = {
  prospectId: string;
  generationExternalRunId: string;
  generatedAt: Date;
};

type PreviewGenerationCandidateRow = {
  previewId: string;
  prospectId: string;
  content: unknown;
};

type CurrentTenPreviewGenerationInventoryRow = Omit<
  CurrentTenPreviewGenerationInventory,
  "generationStates" | "unavailableSectors"
> &
  CurrentTenPreviewGenerationStates;

type CurrentTenUnavailableSectorCountRow = CurrentTenUnavailableSectorCount;

type OpenPreviewGenerationRecordRow = OpenPreviewGenerationRecord;

function isNonEmptyTrimmedText(value: string, maximum: number): boolean {
  return value === value.trim() && value.length > 0 && value.length <= maximum;
}

function validateExternalRunId(value: string): void {
  if (!isNonEmptyTrimmedText(value, 200)) {
    throw new TypeError("Preview generation run ID is invalid.");
  }
}

function validateGenerationResult(
  input: RecordPreviewGenerationResultInput,
): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !SLUG_PATTERN.test(input.slug) ||
    input.slug.length > 120 ||
    !COMPOSITION_DIGEST_PATTERN.test(input.compositionDigest) ||
    !Number.isInteger(input.generationPrNumber) ||
    input.generationPrNumber < 1 ||
    !BRANCH_PATTERN.test(input.generationBranch) ||
    !isNonEmptyTrimmedText(input.generationExternalRunId, 200) ||
    Number.isNaN(input.generatedAt.getTime())
  ) {
    throw new TypeError("Preview generation result is invalid.");
  }

  if (input.reviewDeploymentUrl !== null) {
    const url = new URL(input.reviewDeploymentUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new TypeError("Preview deployment URL is invalid.");
    }
  }
}

export async function listPreviewGenerationCandidates(
  externalRunId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<readonly PreviewGenerationCandidate[]> {
  validateExternalRunId(externalRunId);

  const rows = await db<PreviewGenerationCandidateRow[]>`
    select
      pp.id as "previewId",
      pp.prospect_id as "prospectId",
      pp.content_snapshot as content
    from growth.prospect_previews pp
    inner join growth.prospects p on p.id = pp.prospect_id
    inner join growth.research_runs rr on rr.id = p.research_run_id
    where rr.external_run_id = ${externalRunId}
      and pp.status = 'draft'
      and pp.generation_status = 'pending_pr'
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
    order by pp.created_at asc, pp.id asc
  `;

  return rows.map((row) => ({
    previewId: row.previewId,
    prospectId: row.prospectId,
    snapshot: parseStoredProspectPreviewSnapshot(row.content),
  }));
}

export async function listCurrentTenPreviewGenerationCandidates(
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<readonly PreviewGenerationCandidate[]> {
  const rows = await db<PreviewGenerationCandidateRow[]>`
    select
      pp.id as "previewId",
      pp.prospect_id as "prospectId",
      pp.content_snapshot as content
    from growth.prospect_previews pp
    inner join growth.prospects p on p.id = pp.prospect_id
    inner join growth.website_assessments wa on wa.prospect_id = p.id
    where pp.status = 'draft'
      and pp.generation_status = 'pending_pr'
      and pp.generation_external_run_id is null
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
    order by pp.created_at asc, pp.id asc
    limit 11
  `;

  return rows.map((row) => ({
    previewId: row.previewId,
    prospectId: row.prospectId,
    snapshot: parseStoredProspectPreviewSnapshot(row.content),
  }));
}

export async function listCurrentThirteenEvidenceRefreshCandidates(
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<readonly PreviewGenerationCandidate[]> {
  const rows = await db<PreviewGenerationCandidateRow[]>`
    select
      pp.id as "previewId",
      pp.prospect_id as "prospectId",
      pp.content_snapshot as content
    from growth.prospect_previews pp
    inner join growth.prospects p on p.id = pp.prospect_id
    inner join growth.website_assessments wa on wa.prospect_id = p.id
    where pp.status = 'draft'
      and pp.generation_status = 'pending_pr'
      and pp.generation_external_run_id is null
      and pp.content_snapshot->>'schemaVersion' = '1.1'
      and wa.experience_brief is not null
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
    order by pp.created_at asc, pp.id asc
    limit 14
  `;

  return rows.map((row) => ({
    previewId: row.previewId,
    prospectId: row.prospectId,
    snapshot: parseStoredProspectPreviewSnapshot(row.content),
  }));
}

export async function getCurrentTenPreviewGenerationInventory(
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<CurrentTenPreviewGenerationInventory> {
  const [rows, unavailableSectorRows] = await Promise.all([
    db<CurrentTenPreviewGenerationInventoryRow[]>`
    select
      count(*) filter (
        where pp.status = 'draft'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "activeDrafts",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "assessedDrafts",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'pending_pr'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "pendingAssessedDrafts",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'pending_pr'
          and pp.generation_external_run_id is null
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "eligibleDrafts",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'pending_pr'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "pendingPr",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'pr_open'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "prOpen",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'merged_draft'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "mergedDraft",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'composition_unavailable'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "compositionUnavailable",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'published'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "published",
      count(*) filter (
        where pp.status = 'draft'
          and wa.prospect_id is not null
          and pp.generation_status = 'withdrawn'
          and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      )::integer as "withdrawn"
    from growth.prospect_previews pp
    inner join growth.prospects p on p.id = pp.prospect_id
    left join growth.website_assessments wa on wa.prospect_id = p.id
  `,
    db<CurrentTenUnavailableSectorCountRow[]>`
      select
        pp.content_snapshot->>'sector' as "sector",
        count(*)::integer as "count"
      from growth.prospect_previews pp
      inner join growth.prospects p on p.id = pp.prospect_id
      inner join growth.website_assessments wa on wa.prospect_id = p.id
      where pp.status = 'draft'
        and pp.generation_status = 'composition_unavailable'
        and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      group by pp.content_snapshot->>'sector'
      order by "count" desc, "sector" asc
      limit 10
    `,
  ]);

  const inventory = rows[0];
  if (
    inventory === undefined ||
    !Object.values(inventory).every(
      (count) => Number.isInteger(count) && count >= 0,
    )
  ) {
    throw new TypeError("Current-ten preview generation inventory is invalid.");
  }

  if (
    !unavailableSectorRows.every(
      (row) =>
        typeof row.sector === "string" &&
        isNonEmptyTrimmedText(row.sector, 120) &&
        Number.isInteger(row.count) &&
        row.count > 0,
    )
  ) {
    throw new TypeError("Current-ten unavailable sector inventory is invalid.");
  }

  return {
    activeDrafts: inventory.activeDrafts,
    assessedDrafts: inventory.assessedDrafts,
    pendingAssessedDrafts: inventory.pendingAssessedDrafts,
    eligibleDrafts: inventory.eligibleDrafts,
    generationStates: {
      pendingPr: inventory.pendingPr,
      prOpen: inventory.prOpen,
      mergedDraft: inventory.mergedDraft,
      compositionUnavailable: inventory.compositionUnavailable,
      published: inventory.published,
      withdrawn: inventory.withdrawn,
    },
    unavailableSectors: unavailableSectorRows,
  };
}

export async function requeueCurrentTenUnavailablePreviewCompositions(
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<RequeueCurrentTenUnavailablePreviewCompositionsResult> {
  const rows = await db<Array<{ id: string }>>`
    update growth.prospect_previews pp
    set generation_status = 'pending_pr',
        generation_external_run_id = null,
        generated_at = null,
        updated_at = now()
    from growth.prospects p
    where pp.prospect_id = p.id
      and pp.status = 'draft'
      and pp.generation_status = 'composition_unavailable'
      and pp.generation_external_run_id like 'current-ten-%'
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      and exists (
        select 1
        from growth.website_assessments wa
        where wa.prospect_id = p.id
      )
    returning pp.id
  `;

  return { requeued: rows.length };
}

export async function recordPreviewGenerationResult(
  input: RecordPreviewGenerationResultInput,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<boolean> {
  validateGenerationResult(input);

  const rows = await db<Array<{ id: string }>>`
    update growth.prospect_previews
    set slug = ${input.slug},
        composition_digest = ${input.compositionDigest},
        generation_status = 'pr_open',
        generation_pr_number = ${input.generationPrNumber},
        generation_branch = ${input.generationBranch},
        review_deployment_url = ${input.reviewDeploymentUrl},
        generation_external_run_id = ${input.generationExternalRunId},
        generated_at = ${input.generatedAt},
        updated_at = now()
    where prospect_id = ${input.prospectId}
      and status = 'draft'
      and generation_status = 'pending_pr'
    returning id
  `;

  return rows.length === 1;
}

export async function markPreviewCompositionUnavailable(
  input: MarkPreviewCompositionUnavailableInput,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<boolean> {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !isNonEmptyTrimmedText(input.generationExternalRunId, 200) ||
    Number.isNaN(input.generatedAt.getTime())
  ) {
    throw new TypeError("Preview composition unavailability input is invalid.");
  }

  const rows = await db<Array<{ id: string }>>`
    update growth.prospect_previews
    set generation_status = 'composition_unavailable',
        generation_external_run_id = ${input.generationExternalRunId},
        generated_at = ${input.generatedAt},
        updated_at = now()
    where prospect_id = ${input.prospectId}
      and status = 'draft'
      and generation_status = 'pending_pr'
    returning id
  `;

  return rows.length === 1;
}

export async function listOpenPreviewGenerationRecords(
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<readonly OpenPreviewGenerationRecord[]> {
  const rows = await db<OpenPreviewGenerationRecordRow[]>`
    select
      pp.id as "previewId",
      pp.prospect_id as "prospectId",
      pp.composition_digest as "compositionDigest",
      pp.generation_pr_number as "pullRequestNumber"
    from growth.prospect_previews pp
    where pp.status = 'draft'
      and pp.generation_status = 'pr_open'
    order by pp.generated_at asc nulls last, pp.id asc
  `;

  return rows.map((row) => {
    if (
      !PROSPECT_ID_PATTERN.test(row.previewId) ||
      !PROSPECT_ID_PATTERN.test(row.prospectId) ||
      !COMPOSITION_DIGEST_PATTERN.test(row.compositionDigest) ||
      !Number.isInteger(row.pullRequestNumber) ||
      row.pullRequestNumber < 1
    ) {
      throw new TypeError("Open preview generation record is invalid.");
    }

    return row;
  });
}

export async function markPreviewGenerationMergedDraft(
  input: Pick<OpenPreviewGenerationRecord, "previewId" | "compositionDigest">,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<boolean> {
  if (
    !PROSPECT_ID_PATTERN.test(input.previewId) ||
    !COMPOSITION_DIGEST_PATTERN.test(input.compositionDigest)
  ) {
    throw new TypeError("Preview merge reconciliation input is invalid.");
  }

  const rows = await db<Array<{ id: string }>>`
    update growth.prospect_previews
    set generation_status = 'merged_draft',
        updated_at = now()
    where id = ${input.previewId}
      and status = 'draft'
      and generation_status = 'pr_open'
      and composition_digest = ${input.compositionDigest}
    returning id
  `;
  return rows.length === 1;
}
