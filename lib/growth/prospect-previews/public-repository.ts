import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  PROSPECT_PREVIEW_PUBLIC_ID_PATTERN,
} from "./types";

const PREVIEW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type PublishedCompositionRow = {
  prospectId: string;
  slug: string;
  compositionDigest: string;
};

type PublishedPreviewSlugRow = {
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
      slug
    from growth.prospect_previews
    where public_id = ${publicId}
      and status = 'published'
      and generation_status = 'published'
    limit 1
  `;
  const slug = rows[0]?.slug;

  return slug && PREVIEW_SLUG_PATTERN.test(slug) ? slug : null;
}

export async function getPublishedProspectPreviewCompositionBySlug<
  TComposition extends PublishedPreviewComposition,
>(
  slug: string,
  db: GrowthQueryExecutor,
  resolveComposition: (slug: string) => TComposition | null,
): Promise<TComposition | null> {
  if (!PREVIEW_SLUG_PATTERN.test(slug)) return null;

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
