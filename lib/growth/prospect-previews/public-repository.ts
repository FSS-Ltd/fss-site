import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  PROSPECT_PREVIEW_PUBLIC_ID_PATTERN,
} from "./types";
import {
  isPreviewSlug,
  resolveConceptPreviewSlug,
  resolveKnownBespokePreviewSlug,
} from "./preview-slugs";

type PublishedCompositionRow = {
  prospectId: string;
  slug: string;
  compositionDigest: string;
};

type PublishedPreviewSlugRow = {
  businessName: string;
  generationStatus: string;
  slug: string | null;
};

export type PublishedPreviewComposition = {
  prospectId: string;
  slug: string;
  digest: string;
};

export async function getPublishedProspectPreviewSlug(
  publicId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<string | null> {
  if (!PROSPECT_PREVIEW_PUBLIC_ID_PATTERN.test(publicId)) return null;

  const rows = await db<PublishedPreviewSlugRow[]>`
    select
      coalesce(b.trading_name, b.legal_name) as "businessName",
      pp.generation_status as "generationStatus",
      pp.slug
    from growth.prospect_previews pp
    inner join growth.prospects p on p.id = pp.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    where pp.public_id = ${publicId}
      and pp.status = 'published'
      and pp.generation_status in ('published', 'composition_unavailable')
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  if (row.generationStatus === "composition_unavailable") {
    const bespokeSlug = resolveKnownBespokePreviewSlug(row.businessName);
    if (bespokeSlug === null) return null;
    if (row.slug !== null && row.slug !== bespokeSlug) return null;
    return bespokeSlug;
  }

  return resolveConceptPreviewSlug({
    businessName: row.businessName,
    slug: row.slug,
  });
}

export async function getPublishedProspectPreviewCompositionBySlug<
  TComposition extends PublishedPreviewComposition,
>(
  slug: string,
  db: GrowthQueryExecutor,
  resolveComposition: (slug: string) => TComposition | null,
): Promise<TComposition | null> {
  if (!isPreviewSlug(slug)) return null;

  const rows = await db<PublishedCompositionRow[]>`
    select
      prospect_id as "prospectId",
      slug,
      composition_digest as "compositionDigest"
    from growth.prospect_previews
    where slug = ${slug}
      and status = 'published'
      and generation_status = 'published'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const composition = resolveComposition(slug);
  if (
    composition === null ||
    composition.prospectId !== row.prospectId ||
    composition.slug !== row.slug ||
    composition.digest !== row.compositionDigest
  ) {
    return null;
  }
  return composition;
}
