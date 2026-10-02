import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { requireOperationsFounder } from "../organisations/link-engagement";
import { withAgreementTransaction } from "../agreements/repository";
import { METRIC_DEFINITION_VERSION, londonDate } from "./definitions";
import {
  parseMetricFilters,
  type MetricProviderScope,
  type MetricFilters,
} from "./filters";
import { loadReceivables } from "./receivables-repository";
import { receivablesCsv } from "./export";
import type { ReceivableRow } from "./snapshot-types";
export const EXPORT_ROW_LIMIT = 10000;
export async function requestMetricExport(
  db: OperationsDb,
  founder: OperationsFounder | null,
  raw: unknown,
  scope: NonNullable<MetricProviderScope>,
): Promise<string> {
  const now = new Date().toISOString(),
    filters = parseMetricFilters(raw, now);
  if (filters.to !== londonDate(now))
    throw new Error("Historical invoice exports are unavailable.");
  const provider = z
    .object({
      accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
      mode: z.enum(["test", "live"]),
    })
    .parse(scope);
  return withAgreementTransaction(db, founder, async (tx, actor) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${actor.actorId},12))`;
    const [count] = await tx<
      { count: number }[]
    >`select count(*)::integer as count from operations.metric_export_jobs where state='queued'`;
    if (count.count >= 3)
      throw new Error("Three exports are already queued. Wait for completion.");
    const [job] = await tx<
      { id: string }[]
    >`insert into operations.metric_export_jobs(actor_id,filters,provider_scope,definition_version) values(${actor.actorId},${tx.json(filters)},${tx.json(provider)},${METRIC_DEFINITION_VERSION}) returning id`;
    await tx`insert into operations.metric_export_audit(job_id,actor_id,action) values(${job.id},${actor.actorId},'requested')`;
    return job.id;
  });
}
export async function readMetricExport(
  db: OperationsDb,
  founder: OperationsFounder | null,
  id: string,
  download = false,
): Promise<{
  state: string;
  failure: string | null;
  csv: string | null;
} | null> {
  z.uuid().parse(id);
  return withAgreementTransaction(db, founder, async (tx, actor) => {
    const [row] = await tx<
      { state: string; failure: string | null; csv: string | null }[]
    >`select state,failure,case when ${download} then csv else null end as csv from operations.metric_export_jobs where id=${id}`;
    if (row?.csv)
      await tx`insert into operations.metric_export_audit(job_id,actor_id,action) values(${id},${actor.actorId},'downloaded')`;
    return row ?? null;
  });
}
/** Called by the reviewed background operator, never during the enqueue request. */
export async function runMetricExport(
  db: OperationsDb,
  founder: OperationsFounder,
  jobId: string,
): Promise<boolean> {
  z.uuid().parse(jobId);
  const actor = requireOperationsFounder(founder);
  const result = await db.begin(
    "isolation level repeatable read",
    async (tx) => {
      await tx`select set_config('operations.actor_id',${actor.actorId},true)`;
      await tx`set local statement_timeout='35s'`;
      const [job] = await tx<
        {
          filters: MetricFilters;
          provider_scope: NonNullable<MetricProviderScope>;
          definition_version: string;
        }[]
      >`select filters,provider_scope,definition_version from operations.metric_export_jobs where id=${jobId} and state='queued' for update skip locked`;
      if (!job) return { value: false };
      const started = Date.now(),
        now = new Date().toISOString();
      const filters = parseMetricFilters(
        { ...job.filters, page: 1, pageSize: 100 },
        now,
      );
      if (filters.to !== londonDate(now))
        throw new Error(
          "Export observation day has changed; request a fresh export.",
        );
      const first = await loadReceivables(tx, filters, job.provider_scope);
      let failure: string | null =
        first.totalRows > EXPORT_ROW_LIMIT
          ? "More than 10,000 rows. Narrow the filters and request another export."
          : null;
      const rows: ReceivableRow[] = [...first.rows];
      for (let page = 2; !failure && rows.length < first.totalRows; page++) {
        if (Date.now() - started > 25000) {
          failure =
            "Export exceeded its processing budget. Narrow the filters and retry.";
          break;
        }
        const next = await loadReceivables(
          tx,
          { ...filters, page },
          job.provider_scope,
        );
        rows.push(...next.rows);
      }
      const csv = failure
        ? null
        : receivablesCsv(rows, now, job.definition_version, filters.currency);
      await tx`update operations.metric_export_jobs set state=${failure ? "failed" : "complete"},failure=${failure},csv=${csv},completed_at=now() where id=${jobId}`;
      await tx`insert into operations.metric_export_audit(job_id,actor_id,action) values(${jobId},${actor.actorId},${failure ? "failed" : "completed"})`;
      return { value: true };
    },
  );
  return result.value;
}
