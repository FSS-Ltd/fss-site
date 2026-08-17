import type { GrowthQueryExecutor } from "../../db/types";
import type { PersistEmailAssetInput } from "./service";

export type ProspectRunReference = {
  runId: string;
  prospectId: string;
};

export class EmailAssetAssociationError extends Error {
  constructor() {
    super("The prospect does not belong to the referenced research run.");
    this.name = "EmailAssetAssociationError";
  }
}

export async function prospectBelongsToResearchRun(
  db: GrowthQueryExecutor,
  input: ProspectRunReference,
): Promise<boolean> {
  const rows = await db<Array<{ belongs: boolean }>>`
    select exists (
      select 1
      from growth.prospects p
      where p.id = ${input.prospectId}
        and p.research_run_id = ${input.runId}
    ) as belongs
  `;

  return rows[0]?.belongs === true;
}

export async function persistEmailAssetForRun(
  db: GrowthQueryExecutor,
  input: PersistEmailAssetInput,
): Promise<void> {
  const rows = await db<Array<{ id: string }>>`
    insert into growth.email_assets (
      id,
      prospect_id,
      asset_kind,
      blob_url,
      content_type,
      byte_size,
      width,
      height,
      alt_text,
      prompt_summary,
      sha256,
      review_status,
      created_by
    )
    select
      ${input.id},
      p.id,
      ${input.assetKind},
      ${input.blobUrl},
      ${input.contentType},
      ${input.byteSize},
      ${input.width},
      ${input.height},
      ${input.altText},
      ${input.promptSummary},
      ${input.sha256},
      ${input.reviewStatus},
      ${input.createdBy}
    from growth.prospects p
    where p.id = ${input.prospectId}
      and p.research_run_id = ${input.runId}
    returning id
  `;

  if (rows[0]?.id !== input.id) {
    throw new EmailAssetAssociationError();
  }
}
