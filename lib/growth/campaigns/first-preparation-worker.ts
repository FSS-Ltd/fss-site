import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import { prepareFirstMessageForJob } from "./prepare-first-message";

const batchSchema = z.strictObject({
  workerId: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(25).optional(),
  binding: z.strictObject({
    connectionId: z.uuid(),
    googleSubject: z.string().min(1),
    grantEpoch: z.number().int().positive(),
    grantedScopes: z.array(z.string()).min(1),
  }),
});
export type FirstPreparationBatchSummary = {
  claimed: number;
  prepared: number;
  held: number;
  retry: number;
};

// Caller supplies the actual same-row credential binding after its one batch usage refresh.
export async function runFirstPreparationBatch(
  db: GrowthDb,
  input: { binding: GmailGrantBinding; workerId: string; limit?: number },
): Promise<FirstPreparationBatchSummary> {
  if (!batchSchema.safeParse(input).success) throw new Error("invalid_batch");
  const jobs = await withGrowthTransaction(
    db,
    async (tx) => tx<{ id: string; revision: string }[]>`
    with due as (
      select j.id from growth.outreach_jobs j
      join growth.outreach_outbox o on o.id=j.outbox_id
      join growth.outreach_events e on e.id=o.event_id and e.event_type='record_permission'
      join growth.campaigns c on c.id=j.campaign_id and c.version=j.policy_version
      join growth.campaign_memberships m on m.id=j.membership_id and m.campaign_id=j.campaign_id and m.policy_version=j.policy_version
      join growth.outreach_permissions p on p.id=e.result_id and p.membership_id=m.id and p.provider='gmail'
      where j.job_type='first_preparation' and e.campaign_id=j.campaign_id and e.policy_version=j.policy_version
        and e.membership_id=j.membership_id and c.account_connection_id=${input.binding.connectionId}
        and j.idempotency_key='first-preparation:'||e.id::text
        and j.due_at<=clock_timestamp() and (j.status='pending' or (j.status='leased' and j.lease_until<=clock_timestamp()))
      order by j.due_at,j.id for update of j skip locked limit ${input.limit ?? 25}
    ) update growth.outreach_jobs j set status='leased',lease_owner=${input.workerId},lease_until=clock_timestamp()+interval '5 minutes',lease_revision=j.lease_revision+1
      from due where j.id=due.id returning j.id,j.lease_revision::text as revision`,
  );
  const summary: FirstPreparationBatchSummary = {
    claimed: jobs.length,
    prepared: 0,
    held: 0,
    retry: 0,
  };
  for (const job of jobs) {
    const result = await prepareFirstMessageForJob(db, {
      jobId: job.id,
      leaseOwner: input.workerId,
      leaseRevision: job.revision,
      binding: input.binding,
    });
    if (result.status === "ready") summary.prepared += 1;
    else if (result.reason === "job_retry") summary.retry += 1;
    else summary.held += 1;
  }
  return summary;
}
