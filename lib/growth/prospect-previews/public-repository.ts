import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  parseStoredProspectPreviewSnapshot,
  PROSPECT_PREVIEW_PUBLIC_ID_PATTERN,
  type StoredProspectPreviewSnapshot,
} from "./types";

const PREVIEW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublishedProspectPreview = {
  publicId: string;
  status: "published";
  content: StoredProspectPreviewSnapshot;
};

type PublishedPreviewRow = {
  publicId: string;
  content: unknown;
};

type PublishedCompositionRow = {
  prospectId: string;
  slug: string;
  compositionDigest: string;
};

export type PublishedPreviewComposition = {
  prospectId: string;
  slug: string;
  digest: string;
};

export async function getPublishedProspectPreview(
  publicId: string,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<PublishedProspectPreview | null> {
  if (!PROSPECT_PREVIEW_PUBLIC_ID_PATTERN.test(publicId)) return null;

  const rows = await db<PublishedPreviewRow[]>`
    select
      public_id as "publicId",
      content_snapshot as "content"
    from growth.prospect_previews
    where public_id = ${publicId}
      and status = 'published'
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  try {
    return {
      publicId: row.publicId,
      status: "published",
      content: parseStoredProspectPreviewSnapshot(row.content),
    };
  } catch {
    return null;
  }
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
