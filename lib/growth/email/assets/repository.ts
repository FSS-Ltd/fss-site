import { withGrowthTransaction } from "../../db/client";
import type {
  GrowthDb,
  GrowthQueryExecutor,
  GrowthTransaction,
} from "../../db/types";
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

async function persistEmailAssetInTransaction(
  db: GrowthTransaction,
  input: PersistEmailAssetInput,
): Promise<void> {
  const rows = await db<Array<{ id: string; draftUpdated: boolean }>>`
    with eligible_prospect as (
      select p.id
      from growth.prospects p
      where p.id = ${input.prospectId}
        and p.research_run_id = ${input.runId}
        and (
          ${input.assetKind} <> 'cold_first_email'
          or exists (
            select 1
            from growth.agent_tasks at
            where at.research_run_id = ${input.runId}
              and at.prospect_id = p.id
              and at.task_type = 'first_email_draft'
              and at.status = 'completed'
          )
        )
    ), inserted_asset as (
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
      from eligible_prospect p
      returning id, prospect_id, asset_kind, alt_text
    ), updated_draft as (
      update growth.agent_tasks at
      set output_snapshot = jsonb_set(
            at.output_snapshot,
            '{visual}',
            jsonb_build_object(
              'kind', 'stored',
              'assetId', ea.id,
              'altText', ea.alt_text,
              'conceptDisclaimer',
                at.output_snapshot #>> '{visual,conceptDisclaimer}'
            ),
            true
          ),
          updated_at = now()
      from inserted_asset ea
      where ea.asset_kind = 'cold_first_email'
        and at.id = (
          select latest.id
          from growth.agent_tasks latest
          where latest.research_run_id = ${input.runId}
            and latest.prospect_id = ea.prospect_id
            and latest.task_type = 'first_email_draft'
            and latest.status = 'completed'
          order by latest.created_at desc, latest.id desc
          limit 1
        )
      returning at.id
    )
    select
      ea.id,
      (
        ea.asset_kind <> 'cold_first_email'
        or exists (select 1 from updated_draft)
      ) as "draftUpdated"
    from inserted_asset ea
  `;

  if (rows[0]?.id !== input.id || rows[0].draftUpdated !== true) {
    throw new EmailAssetAssociationError();
  }
}

export function persistEmailAssetForRun(
  db: GrowthDb,
  input: PersistEmailAssetInput,
): Promise<void> {
  return withGrowthTransaction(db, (transaction) =>
    persistEmailAssetInTransaction(transaction, input),
  );
}
