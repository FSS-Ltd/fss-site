import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import type { ViewState } from "../dashboard/view-models";
import {
  parseStoredProspectPreviewSnapshot,
  type StoredProspectPreviewSnapshot,
} from "./types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FounderDraftProspectPreviewSummary = {
  businessName: string;
  compositionDigest: string | null;
  generationPrNumber: number | null;
  generationStatus: string | null;
  previewVersion: number;
  prospectId: string;
  prospectStatus: string;
  prospectVersion: number;
  slug: string | null;
};

export type FounderDraftProspectPreview = {
  content: StoredProspectPreviewSnapshot;
  prospectId: string;
  slug: string | null;
};

type FounderDraftPreviewSummaryRow = FounderDraftProspectPreviewSummary;

type FounderDraftPreviewRow = {
  content: unknown;
  prospectId: string;
  slug: string | null;
};

export type FounderDraftProspectPreviewResult =
  | { status: "found"; data: FounderDraftProspectPreview }
  | { status: "not_found" }
  | { status: "error"; correlationId: string; message: string };

export async function getFounderDraftProspectPreviewSummaries(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<readonly FounderDraftProspectPreviewSummary[]>> {
  try {
    const rows = await db<FounderDraftPreviewSummaryRow[]>`
      select
        coalesce(b.trading_name, b.legal_name) as "businessName",
        pp.composition_digest as "compositionDigest",
        pp.generation_pr_number as "generationPrNumber",
        pp.generation_status as "generationStatus",
        pp.slug,
        pp.version as "previewVersion",
        p.id as "prospectId",
        p.status as "prospectStatus",
        p.version as "prospectVersion"
      from growth.prospect_previews pp
      inner join growth.prospects p on p.id = pp.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      where pp.status = 'draft'
      order by pp.created_at asc, pp.id asc
    `;

    if (rows.length === 0) {
      return {
        status: "empty",
        reason: "No private concept previews are awaiting approval.",
      };
    }
    return { status: "ready", data: rows };
  } catch {
    return {
      status: "error",
      message: "The concept preview list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}

export async function getFounderDraftProspectPreview(
  prospectId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<FounderDraftProspectPreviewResult> {
  if (!PROSPECT_ID_PATTERN.test(prospectId)) return { status: "not_found" };

  try {
    const rows = await db<FounderDraftPreviewRow[]>`
      select
        pp.content_snapshot as content,
        p.id as "prospectId",
        pp.slug
      from growth.prospect_previews pp
      inner join growth.prospects p on p.id = pp.prospect_id
      where p.id = ${prospectId}
        and pp.status = 'draft'
      limit 1
    `;
    const row = rows[0];
    if (!row) return { status: "not_found" };

    return {
      status: "found",
      data: {
        prospectId: row.prospectId,
        content: parseStoredProspectPreviewSnapshot(row.content),
        slug: row.slug,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The private concept preview could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
