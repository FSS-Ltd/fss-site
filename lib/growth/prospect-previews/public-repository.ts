import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import {
  parseStoredProspectPreviewSnapshot,
  PROSPECT_PREVIEW_PUBLIC_ID_PATTERN,
  type StoredProspectPreviewSnapshot,
} from "./types";

export type PublishedProspectPreview = {
  publicId: string;
  status: "published";
  content: StoredProspectPreviewSnapshot;
};

type PublishedPreviewRow = {
  publicId: string;
  content: unknown;
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
