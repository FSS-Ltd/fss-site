import { randomUUID } from "node:crypto";

import type postgres from "postgres";

import { sectorExamples } from "../lib/sector-examples/catalog";

import { appendAuditEvent } from "../lib/growth/audit/service";
import { resolveSiteUrl } from "../lib/config/site-url";
import { createGrowthDb, withGrowthTransaction } from "../lib/growth/db/client";
import type { GrowthDb, GrowthTransaction } from "../lib/growth/db/types";
import {
  FirstEmailTemplateRefreshError,
  refreshFirstEmailTemplate,
} from "../lib/growth/sequences/first-email-template-refresh";

type DraftCandidate = {
  id: string;
};

type LockedDraft = {
  id: string;
  prospectId: string;
  status: string;
  outputSnapshot: unknown;
  completedAt: Date | null;
  hasEnrollment: boolean;
  previewSlug: string | null;
  sector: string;
  businessName: string;
  trustSignals: unknown;
  conversionPlan: unknown;
  firstPartyEvidenceUrl: string | null;
};

type RefreshCounts = {
  unchanged: number;
  refreshed: number;
  skipped: number;
};

function toJsonValue(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres or postgresql.");
  }
  return value;
}

async function findEligibleDraftIds(db: GrowthDb): Promise<readonly string[]> {
  const rows = await db<DraftCandidate[]>`
    select at.id
    from growth.agent_tasks at
    inner join growth.prospects p on p.id = at.prospect_id
    where at.task_type = 'first_email_draft'
      and at.status = 'completed'
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
      and not exists (
        select 1
        from growth.sequence_enrollments se
        where se.prospect_id = at.prospect_id
      )
    order by at.completed_at asc nulls last, at.id asc
  `;
  return rows.map((row) => row.id);
}

async function lockDraft(
  transaction: GrowthTransaction,
  draftTaskId: string,
): Promise<LockedDraft | null> {
  const rows = await transaction<LockedDraft[]>`
    select
      at.id,
      at.prospect_id as "prospectId",
      at.status,
      at.output_snapshot as "outputSnapshot",
      at.completed_at as "completedAt",
      case when pp.status = 'published' then pp.slug else null end as "previewSlug",
      b.sector,
      b.legal_name as "businessName",
      wa.trust_signals as "trustSignals",
      wa.conversion_plan as "conversionPlan",
      (select se.source_url from growth.source_evidence se
       where se.prospect_id = at.prospect_id and se.source_type = 'first_party'
       order by se.verified_at desc, se.created_at desc limit 1) as "firstPartyEvidenceUrl",
      exists (
        select 1
        from growth.sequence_enrollments se
        where se.prospect_id = at.prospect_id
      ) as "hasEnrollment"
    from growth.agent_tasks at
    inner join growth.prospects p on p.id = at.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    left join growth.prospect_previews pp on pp.prospect_id = at.prospect_id
    left join growth.website_assessments wa on wa.prospect_id = at.prospect_id
    where at.id = ${draftTaskId}
      and at.task_type = 'first_email_draft'
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
    for update of at, p
  `;
  const draft = rows[0];
  if (!draft) return null;
  // Re-read after acquiring the prospect lock, as approval may have enrolled
  // the prospect while this transaction was waiting for that lock.
  const enrollments = await transaction<Array<{ exists: boolean }>>`
    select exists (
      select 1 from growth.sequence_enrollments
      where prospect_id = ${draft.prospectId}
    ) as exists
  `;
  return { ...draft, hasEnrollment: enrollments[0]?.exists === true };
}

async function refreshDraft(
  db: GrowthDb,
  draftTaskId: string,
  siteUrl: string,
  correlationId: string,
  apply: boolean,
): Promise<keyof RefreshCounts> {
  return withGrowthTransaction(db, async (transaction) => {
    const draft = await lockDraft(transaction, draftTaskId);
    if (!draft) return "skipped";

    try {
      const result = refreshFirstEmailTemplate({
        draft,
        previewUrl: draft.previewSlug
          ? new URL(`/preview/${draft.previewSlug}`, siteUrl).toString()
          : undefined,
        sector: draft.sector,
        businessName: draft.businessName,
        siteUrl,
        refreshedAt: new Date(),
        historicalAssessment: {
          trustSignals: draft.trustSignals,
          conversionPlan: draft.conversionPlan,
          firstPartyEvidenceUrl: draft.firstPartyEvidenceUrl,
        },
      });
      if (result.status === "unchanged") return "unchanged";
      if (!apply) return "refreshed";

      const updated = await transaction<Array<{ id: string }>>`
        update growth.agent_tasks
        set output_snapshot = ${transaction.json(toJsonValue(result.outputSnapshot))},
            updated_at = now()
        where id = ${draft.id}
          and task_type = 'first_email_draft'
          and status = 'completed'
        returning id
      `;
      if (!updated[0]) return "skipped";

      await appendAuditEvent(transaction, {
        correlationId,
        actorType: "system",
        actorId: "first-email-template-refresh",
        action: "email_draft.template_refreshed",
        entityType: "agent_task",
        entityId: draft.id,
      });
      return "refreshed";
    } catch (error) {
      if (error instanceof FirstEmailTemplateRefreshError) return "skipped";
      throw error;
    }
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply"))
    throw new Error(
      "Use no arguments for dry run, or --apply after the examples are deployed.",
    );
  const apply = args.includes("--apply");
  const siteUrl = resolveSiteUrl();
  if (apply) {
    for (const example of sectorExamples) {
      const response = await fetch(
        new URL(`/examples/${example.slug}`, siteUrl),
        {
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (
        !response.ok ||
        !(await response.text()).includes(`data-example-slug="${example.slug}"`)
      ) {
        throw new Error(
          "All example sites must be publicly deployed before refreshing live drafts.",
        );
      }
    }
  }
  const db = createGrowthDb(readDatabaseUrl());
  const correlationId = `first-email-template-refresh:${randomUUID()}`;
  const counts: RefreshCounts = { unchanged: 0, refreshed: 0, skipped: 0 };

  try {
    const draftIds = await findEligibleDraftIds(db);
    for (const draftTaskId of draftIds) {
      const outcome = await refreshDraft(
        db,
        draftTaskId,
        siteUrl,
        correlationId,
        apply,
      );
      counts[outcome] += 1;
    }
    process.stdout.write(
      `${JSON.stringify({ mode: apply ? "apply" : "dry-run", considered: draftIds.length, ...counts })}\n`,
    );
  } finally {
    await db.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : "Unknown error.";
  process.stderr.write(`First-email template refresh failed: ${detail}\n`);
  process.exitCode = 1;
});
