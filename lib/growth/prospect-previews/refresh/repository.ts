import { withGrowthTransaction } from "../../db/client";
import type { GrowthDb, GrowthTransaction } from "../../db/types";
import { parseStoredProspectPreviewSnapshot } from "../types";
import type {
  ProspectPreviewRefreshRepository,
  ProspectPreviewRefreshTransaction,
  RefreshableProspectPreview,
  ReplaceDraftPreviewInput,
} from "./service";

type RefreshablePreviewRow = {
  status: string;
  generationStatus: string;
  firstPartySourceUrl: string;
  snapshot: unknown;
};

const PREVIEW_STATUSES = new Set(["draft", "published", "withdrawn"]);
const GENERATION_STATUSES = new Set([
  "pending_pr",
  "pr_open",
  "merged_draft",
  "composition_unavailable",
  "published",
  "withdrawn",
]);

function parseRefreshablePreview(
  row: RefreshablePreviewRow | undefined,
): RefreshableProspectPreview | null {
  if (row === undefined) return null;
  if (
    !PREVIEW_STATUSES.has(row.status) ||
    !GENERATION_STATUSES.has(row.generationStatus) ||
    typeof row.firstPartySourceUrl !== "string" ||
    !row.firstPartySourceUrl.startsWith("http")
  ) {
    throw new TypeError("Stored prospect preview refresh record is invalid.");
  }

  return {
    status: row.status as RefreshableProspectPreview["status"],
    generationStatus:
      row.generationStatus as RefreshableProspectPreview["generationStatus"],
    firstPartySourceUrl: row.firstPartySourceUrl,
    snapshot: parseStoredProspectPreviewSnapshot(row.snapshot),
  };
}

function createRefreshTransaction(
  tx: GrowthTransaction,
): ProspectPreviewRefreshTransaction {
  return {
    async loadPreview(prospectId) {
      const rows = await tx<RefreshablePreviewRow[]>`
        select
          preview.status,
          preview.generation_status as "generationStatus",
          business.first_party_source_url as "firstPartySourceUrl",
          preview.content_snapshot as snapshot
        from growth.prospect_previews preview
        inner join growth.prospects prospect on prospect.id = preview.prospect_id
        inner join growth.businesses business on business.id = prospect.business_id
        where preview.prospect_id = ${prospectId}
          and prospect.status not in ('won', 'lost', 'rejected', 'suppressed')
        for update of preview
      `;
      return parseRefreshablePreview(rows[0]);
    },

    async replaceDraftPreview(input: ReplaceDraftPreviewInput) {
      for (const evidence of input.brandEvidence) {
        await tx`
          insert into growth.prospect_preview_evidence (
            id,
            prospect_id,
            research_run_id,
            evidence_kind,
            source_url,
            evidence_text,
            observed_at
          )
          select
            ${evidence.id},
            prospect.id,
            prospect.research_run_id,
            ${
              evidence.kind === "brand-colours"
                ? "brand_colours"
                : evidence.kind === "service-language"
                  ? "service_language"
                  : evidence.kind === "on-site-image"
                    ? "on_site_image"
                    : "logo"
            },
            ${evidence.sourceUrl},
            ${evidence.evidenceText},
            ${evidence.observedAt}
          from growth.prospects prospect
          where prospect.id = ${input.prospectId}
          on conflict on constraint prospect_preview_evidence_source_unique
          do update set observed_at = excluded.observed_at
        `;
      }

      const assessmentRows = await tx<Array<{ id: string }>>`
        update growth.website_assessments assessment
        set experience_brief = ${tx.json(input.experienceBrief)},
            status = 'pending_review',
            version = assessment.version + 1,
            updated_at = now()
        where assessment.prospect_id = ${input.prospectId}
        returning assessment.id
      `;
      if (assessmentRows.length !== 1) return false;

      const previewRows = await tx<Array<{ id: string }>>`
        update growth.prospect_previews preview
        set content_snapshot = ${tx.json(input.snapshot)},
            composition_digest = null,
            generation_status = 'pending_pr',
            generation_pr_number = null,
            generation_branch = null,
            review_deployment_url = null,
            generation_external_run_id = null,
            generated_at = null,
            version = preview.version + 1,
            updated_at = now()
        where preview.prospect_id = ${input.prospectId}
          and preview.status = 'draft'
          and preview.generation_status in (
            'pending_pr',
            'composition_unavailable',
            'merged_draft'
          )
        returning preview.id
      `;
      return previewRows.length === 1;
    },
  };
}

export function createProspectPreviewRefreshRepository(
  db: GrowthDb,
): ProspectPreviewRefreshRepository {
  return {
    withTransaction: (operation) =>
      withGrowthTransaction(db, (tx) => operation(createRefreshTransaction(tx))),
  };
}
