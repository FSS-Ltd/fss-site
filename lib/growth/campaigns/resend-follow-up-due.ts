import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { hasFollowUpReplyCoverage } from "./follow-up-anchor";
import { loadResendFollowUpAnchor } from "./resend-follow-up-anchor";
import { loadResendAccountReadiness } from "./resend-account-repository";
import type { ResendRuntimeConfiguration } from "./resend-account-control";

/** Only a current, complete Gmail observation may wake a receipt-held follow-up. */
export async function claimResendFollowUps(
  db: GrowthDb,
  input: {
    connectionId: string;
    runtime: ResendRuntimeConfiguration;
    coverageId: string;
    workerId: string;
    limit: number;
  },
): Promise<Array<{ id: string; revision: string }>> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 25)
    return [];
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const account = await loadResendAccountReadiness(
      tx,
      input.connectionId,
      input.runtime,
    );
    if (account.status !== "ready") return [];
    const jobs = await tx<{ id: string; membershipId: string; step: number }[]>`
      select j.id,m.id as "membershipId",case when j.idempotency_key='campaign-followup:'||m.id::text||':1' then 1 else 2 end as step
      from growth.outreach_jobs j join growth.campaign_memberships m on m.id=j.membership_id and m.campaign_id=j.campaign_id and m.policy_version=j.policy_version
      join growth.campaigns c on c.id=j.campaign_id and c.version=j.policy_version
      where j.job_type='follow_up' and c.account_connection_id=${input.connectionId} and c.policy->>'provider'='resend' and m.status='active' and c.status='approved'
        and j.idempotency_key in ('campaign-followup:'||m.id::text||':1','campaign-followup:'||m.id::text||':2')
        and j.due_at<=clock_timestamp() and (j.status='pending' or (j.status='held' and (j.last_error_code is null or j.last_error_code in ('reply_coverage_unknown','usage_unknown','terminal_fence_busy','account_not_active','preparation_expired'))) or (j.status='leased' and j.lease_until<=clock_timestamp()))
      order by j.due_at,j.id limit ${input.limit} for update of j skip locked`;
    const claimed: Array<{ id: string; revision: string }> = [];
    for (const job of jobs) {
      const anchor = await loadResendFollowUpAnchor(tx, {
        membershipId: job.membershipId,
        connectionId: input.connectionId,
        step: job.step === 1 ? 1 : 2,
        runtime: input.runtime,
      });
      if (
        !anchor ||
        !(await hasFollowUpReplyCoverage(tx, {
          connectionId: account.monitoredMailbox.connectionId,
          googleSubject: account.monitoredMailbox.googleSubject,
          submittedAt: anchor.submittedAt,
          coverageId: input.coverageId,
        }))
      )
        continue;
      const [leased] = await tx<
        { id: string; revision: string }[]
      >`update growth.outreach_jobs set status='leased',lease_owner=${input.workerId},lease_until=clock_timestamp()+interval '5 minutes',lease_revision=lease_revision+1 where id=${job.id} returning id,lease_revision::text as revision`;
      if (leased) claimed.push(leased);
    }
    return claimed;
  });
}

export async function holdResendFollowUp(
  db: GrowthDb,
  input: {
    jobId: string;
    leaseOwner: string;
    leaseRevision: string;
    connectionId: string;
    reason: string;
  },
): Promise<void> {
  const reason = /^[a-z][a-z0-9_]{0,99}$/.test(input.reason)
    ? input.reason
    : "preparation_unavailable";
  await withGrowthTransaction(db, async (tx) => {
    await tx`update growth.outreach_jobs j set status='held',lease_until=null,last_error_code=${reason} from growth.campaigns c where j.id=${input.jobId} and j.job_type='follow_up' and j.campaign_id=c.id and j.policy_version=c.version and c.account_connection_id=${input.connectionId} and c.policy->>'provider'='resend' and j.status='leased' and j.lease_owner=${input.leaseOwner} and j.lease_revision=${input.leaseRevision}::bigint and j.lease_until>clock_timestamp()`;
  });
}
