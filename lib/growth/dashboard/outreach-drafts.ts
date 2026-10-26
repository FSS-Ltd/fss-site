import { randomUUID } from "node:crypto";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

export type OutreachDraftRow = {
  draftTaskId: string;
  businessName: string;
  contactName: string;
  completedAt: string;
};

export type OutreachDraftsResult =
  | { status: "ready"; rows: readonly OutreachDraftRow[] }
  | { status: "error"; message: string; correlationId: string };

export async function getOutreachDrafts(
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = randomUUID,
): Promise<OutreachDraftsResult> {
  try {
    const rows = await db<
      (Omit<OutreachDraftRow, "contactName" | "completedAt"> & {
        contactName: string | null;
        completedAt: Date;
      })[]
    >`
      select
        draft.id as "draftTaskId",
        b.legal_name as "businessName",
        nullif(concat_ws(' ', nullif(trim(c.first_name), ''), nullif(trim(c.last_name), '')), '') as "contactName",
        draft.completed_at as "completedAt"
      from growth.prospects p
      inner join growth.businesses b on b.id = p.business_id
      inner join growth.contacts c on c.id = p.primary_contact_id
      inner join lateral (
        select at.id, at.output_snapshot,
          coalesce(at.completed_at, at.created_at) as completed_at
        from growth.agent_tasks at
        where at.prospect_id = p.id
          and at.task_type = 'first_email_draft'
          and at.status = 'completed'
        order by coalesce(at.completed_at, at.created_at) desc, at.id desc
        limit 1
      ) draft on true
      where p.status = 'ready_for_email_review'
        and coalesce(draft.output_snapshot ->> 'reviewState', 'draft') in ('draft', 'research_only')
        and not exists (
          select 1 from growth.sequence_enrollments se
          where se.prospect_id = p.id
        )
      order by p.fit_score desc, draft.completed_at desc, draft.id desc
      limit ${50}
    `;

    return {
      status: "ready",
      rows: rows.map((row) => ({
        ...row,
        contactName: row.contactName ?? "Unnamed contact",
        completedAt: row.completedAt.toISOString(),
      })),
    };
  } catch {
    return {
      status: "error",
      message: "Email drafts could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
