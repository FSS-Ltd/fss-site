import { randomUUID } from "node:crypto";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { publishMonthlyReport } from "./monthly-report";

type ClaimedReport = {
  id: string;
  revision: string;
  anchorRevision: number;
  anchorReservationId: string;
};

export async function runMonthlyReportBatch(db: GrowthDb): Promise<{
  claimed: number;
  published: number;
  held: number;
  retry: number;
}> {
  const owner = `monthly-report:${randomUUID()}`;
  const jobs = await withGrowthTransaction(
    db,
    async (tx) => tx<ClaimedReport[]>`
    with due as (
      select j.id from growth.outreach_jobs j
      where j.job_type='monthly_report' and j.membership_id is null
        and j.anchor_reservation_id is not null and j.anchor_revision>0
        and j.due_at<=clock_timestamp()
        and (j.status='pending' or (j.status='leased' and j.lease_until<=clock_timestamp()))
      order by j.lease_revision,j.due_at,j.id for update of j skip locked limit 5
    ) update growth.outreach_jobs j set status='leased',lease_owner=${owner},
      lease_until=clock_timestamp()+interval '5 minutes',lease_revision=j.lease_revision+1
      from due where j.id=due.id
      returning j.id,j.lease_revision::text as revision,j.anchor_revision as "anchorRevision",
        j.anchor_reservation_id as "anchorReservationId"`,
  );
  const summary = { claimed: jobs.length, published: 0, held: 0, retry: 0 };
  for (const job of jobs) {
    try {
      const result = await publishMonthlyReport(db, {
        jobId: job.id,
        leaseOwner: owner,
        leaseRevision: job.revision,
        anchorRevision: job.anchorRevision,
        anchorReservationId: job.anchorReservationId,
      });
      if (result.status === "ready") {
        summary.published++;
        continue;
      }
      const reason = /^[a-z][a-z0-9_]{0,99}$/.test(result.reason)
        ? result.reason
        : "report_held";
      const settled = await db<{ id: string }[]>`update growth.outreach_jobs
        set status='held',lease_owner=null,lease_until=null,last_error_code=${reason}
        where id=${job.id} and status='leased' and lease_owner=${owner}
          and lease_revision=${job.revision}::bigint and anchor_revision=${job.anchorRevision}
          and anchor_reservation_id=${job.anchorReservationId} and lease_until>clock_timestamp()
        returning id`;
      if (settled.length) summary.held++;
      else summary.retry++;
    } catch {
      // Leave the lease to expire; a higher revision moves retries behind less-tried jobs.
      await db`update growth.outreach_jobs set last_error_code='report_execution_failed'
        where id=${job.id} and status='leased' and lease_owner=${owner}
          and lease_revision=${job.revision}::bigint and anchor_revision=${job.anchorRevision}
          and anchor_reservation_id=${job.anchorReservationId} and lease_until>clock_timestamp()`;
      summary.retry++;
    }
  }
  return summary;
}
