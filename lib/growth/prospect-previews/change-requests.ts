import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;

export type CreatePreviewChangeRequestInput = {
  prospectId: string;
  compositionDigest: string;
  notes: string;
  createdBy: string;
};

export type PreviewChangeRequest = {
  id: string;
  generationPrNumber: number | null;
};

function validateInput(input: CreatePreviewChangeRequestInput): void {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    !DIGEST_PATTERN.test(input.compositionDigest) ||
    !ACTOR_ID_PATTERN.test(input.createdBy) ||
    input.notes !== input.notes.trim() ||
    input.notes.length < 1 ||
    input.notes.length > 2_000
  ) {
    throw new TypeError("Preview change request is invalid.");
  }
}

export async function createPreviewChangeRequest(
  input: CreatePreviewChangeRequestInput,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<PreviewChangeRequest | null> {
  validateInput(input);

  const rows = await db<PreviewChangeRequest[]>`
    insert into growth.prospect_preview_change_requests (
      prospect_preview_id,
      composition_digest,
      generation_pr_number,
      notes,
      created_by
    )
    select
      pp.id,
      ${input.compositionDigest},
      pp.generation_pr_number,
      ${input.notes},
      ${input.createdBy}
    from growth.prospect_previews pp
    where pp.prospect_id = ${input.prospectId}
      and pp.composition_digest = ${input.compositionDigest}
      and pp.status = 'draft'
      and pp.generation_status in ('pr_open', 'merged_draft')
    returning
      id,
      generation_pr_number as "generationPrNumber"
  `;

  return rows[0] ?? null;
}
