import { withGrowthTransaction } from "../../db/client";
import type { GrowthDb, GrowthTransaction } from "../../db/types";
import type {
  PersistProspectPreviewAssetInput,
  ProspectPreviewSourceAssetKind,
} from "./service";

const databaseAssetKindBySourceAssetKind = {
  logo: "logo",
  "on-site-image": "on_site_image",
} as const;

const ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PreviewAssetAssociationError extends Error {
  constructor() {
    super(
      "The preview asset does not match a first-party evidence record and draft preview.",
    );
    this.name = "PreviewAssetAssociationError";
  }
}

export type PreviewEvidenceSourceReference = {
  runId: string;
  prospectId: string;
  evidenceId: string;
  sourceUrl: string;
  assetKind: ProspectPreviewSourceAssetKind;
};

export type RenderableProspectPreviewAsset = {
  blobUrl: string;
  contentType: "image/webp";
};

type RenderableProspectPreviewAssetRow = {
  blobUrl: string;
  contentType: string;
};

export async function sourceEvidenceCanAcceptAsset(
  db: GrowthDb,
  input: PreviewEvidenceSourceReference,
): Promise<boolean> {
  const rows = await db<Array<{ matches: boolean }>>`
    select exists (
      select 1
      from growth.prospect_preview_evidence ppe
      inner join growth.prospects p on p.id = ppe.prospect_id
      where ppe.id = ${input.evidenceId}
        and ppe.prospect_id = ${input.prospectId}
        and ppe.research_run_id = ${input.runId}
        and p.research_run_id = ${input.runId}
        and ppe.source_url = ${input.sourceUrl}
        and ppe.evidence_kind = ${databaseAssetKindBySourceAssetKind[input.assetKind]}
    ) as matches
  `;

  return rows[0]?.matches === true;
}

async function persistProspectPreviewAssetInTransaction(
  db: GrowthTransaction,
  input: PersistProspectPreviewAssetInput,
): Promise<void> {
  const rows = await db<Array<{ id: string; draftUpdated: boolean }>>`
    with eligible_evidence as (
      select ppe.id, ppe.prospect_id
      from growth.prospect_preview_evidence ppe
      inner join growth.prospects p on p.id = ppe.prospect_id
      where ppe.id = ${input.evidenceId}
        and ppe.prospect_id = ${input.prospectId}
        and ppe.research_run_id = ${input.runId}
        and p.research_run_id = ${input.runId}
    ), inserted_asset as (
      insert into growth.prospect_preview_assets (
        id,
        prospect_id,
        preview_evidence_id,
        asset_kind,
        blob_url,
        content_type,
        byte_size,
        width,
        height,
        alt_text,
        sha256,
        review_status,
        created_by
      )
      select
        ${input.id},
        evidence.prospect_id,
        evidence.id,
        ${databaseAssetKindBySourceAssetKind[input.assetKind]},
        ${input.blobUrl},
        ${input.contentType},
        ${input.byteSize},
        ${input.width},
        ${input.height},
        ${input.altText},
        ${input.sha256},
        ${input.reviewStatus},
        ${input.createdBy}
      from eligible_evidence evidence
      returning id, prospect_id, preview_evidence_id, asset_kind
    ), updated_draft as (
      update growth.prospect_previews preview
      set content_snapshot = jsonb_set(
            preview.content_snapshot,
            case asset.asset_kind
              when 'logo' then '{experienceBrief,visual,logoAssetId}'::text[]
              when 'on_site_image' then '{experienceBrief,visual,onSiteImageAssetId}'::text[]
            end,
            to_jsonb(asset.id::text),
            true
          ),
          updated_at = now()
      from inserted_asset asset
      where preview.prospect_id = asset.prospect_id
        and preview.status = 'draft'
        and preview.content_snapshot ->> 'schemaVersion' = '1.1'
        and (
          (asset.asset_kind = 'logo'
            and preview.content_snapshot #>> '{experienceBrief,visual,logoEvidenceId}'
              = asset.preview_evidence_id::text)
          or (asset.asset_kind = 'on_site_image'
            and preview.content_snapshot #>> '{experienceBrief,visual,onSiteImageEvidenceId}'
              = asset.preview_evidence_id::text)
        )
      returning preview.id
    )
    select
      asset.id,
      exists (select 1 from updated_draft) as "draftUpdated"
    from inserted_asset asset
  `;

  if (rows[0]?.id !== input.id || rows[0].draftUpdated !== true) {
    throw new PreviewAssetAssociationError();
  }
}

export function persistProspectPreviewAssetForRun(
  db: GrowthDb,
  input: PersistProspectPreviewAssetInput,
): Promise<void> {
  return withGrowthTransaction(db, (transaction) =>
    persistProspectPreviewAssetInTransaction(transaction, input),
  );
}

export async function findRenderableProspectPreviewAsset(
  db: GrowthDb,
  input: { assetId: string; isProduction: boolean },
): Promise<RenderableProspectPreviewAsset | null> {
  if (!ASSET_ID_PATTERN.test(input.assetId)) return null;

  const rows = await db<RenderableProspectPreviewAssetRow[]>`
    select
      asset.blob_url as "blobUrl",
      asset.content_type as "contentType"
    from growth.prospect_preview_assets asset
    inner join growth.prospect_previews preview
      on preview.prospect_id = asset.prospect_id
    where asset.id = ${input.assetId}
      and (
        preview.content_snapshot #>> '{experienceBrief,visual,logoAssetId}'
          = asset.id::text
        or preview.content_snapshot #>> '{experienceBrief,visual,onSiteImageAssetId}'
          = asset.id::text
        or preview.content_snapshot #>> '{experienceBrief,visual,approvedHeroMediaAssetId}'
          = asset.id::text
      )
      and asset.review_status in ('source_verified', 'approved')
      and (asset.asset_kind <> 'hero_media' or asset.review_status = 'approved')
      and (
        (
          ${input.isProduction}
          and preview.status = 'published'
          and preview.generation_status = 'published'
        )
        or (
          not ${input.isProduction}
          and preview.status = 'draft'
        )
      )
    limit 1
  `;
  const row = rows[0];
  if (
    row === undefined ||
    row.contentType !== "image/webp" ||
    !row.blobUrl.startsWith("https://")
  ) {
    return null;
  }

  return { blobUrl: row.blobUrl, contentType: "image/webp" };
}
