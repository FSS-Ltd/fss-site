import { randomUUID } from "node:crypto";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import type {
  BoundGmailClient,
  GmailGrantBinding,
} from "../integrations/gmail/live-client";
import { refreshGmailUsage } from "../integrations/gmail/usage-service";
import { createGmailReplySync } from "../sequences/gmail-sync";
import { postgresGmailSyncRepository } from "../sequences/gmail-sync-repository";
import {
  runFirstPreparationBatch,
  type FirstPreparationBatchSummary,
} from "./first-preparation-worker";
import { prepareFollowUp } from "./prepare-follow-up";

const MAX_BATCH = 25;
const FIRST_SHARE = 13;
const RETRYABLE_HOLDS = new Set([
  "terminal_fence_busy",
  "usage_unknown",
  "account_not_active",
  "reply_coverage_unknown",
]);
const SAFE_REASON = /^[a-z][a-z0-9_]{0,99}$/;
type FollowUpJob = { id: string; revision: string };
type FollowUpSummary = {
  claimed: number;
  prepared: number;
  held: number;
  retry: number;
  stale: number;
};
type FirstInput = {
  binding: GmailGrantBinding;
  workerId: string;
  limit: number;
};
type FollowInput = { connectionId: string; workerId: string; limit: number };
type PrepareInput = {
  jobId: string;
  leaseOwner: string;
  leaseRevision: string;
  connectionId: string;
  coverageId: string;
};
type Ports = {
  bound: BoundGmailClient;
  workerId: string;
  refreshUsage: (
    db: GrowthDb,
    bound: BoundGmailClient,
  ) => Promise<{ status: "complete" } | { status: "held"; reason: string }>;
  sync: (
    db: GrowthDb,
    bound: BoundGmailClient,
  ) => Promise<{ coverageId: string | null }>;
  first: (
    db: GrowthDb,
    input: FirstInput,
  ) => Promise<FirstPreparationBatchSummary>;
  claimFollowUps: (db: GrowthDb, input: FollowInput) => Promise<FollowUpJob[]>;
  prepareFollowUp: (
    db: GrowthDb,
    input: PrepareInput,
  ) => ReturnType<typeof prepareFollowUp>;
  settleFollowUp: (
    db: GrowthDb,
    input: PrepareInput & { reason: string },
  ) => Promise<"retry" | "held" | "stale">;
};
export type OutreachDueSummary = {
  usage: "complete" | "held";
  first: FirstPreparationBatchSummary;
  followUp: FollowUpSummary;
};
const emptyFirst = (): FirstPreparationBatchSummary => ({
  claimed: 0,
  prepared: 0,
  held: 0,
  retry: 0,
});

export function createOutreachDueWorker(ports: Ports) {
  return async (db: GrowthDb): Promise<OutreachDueSummary> => {
    const summary: OutreachDueSummary = {
      usage: "complete",
      first: emptyFirst(),
      followUp: { claimed: 0, prepared: 0, held: 0, retry: 0, stale: 0 },
    };
    const usage = await ports.refreshUsage(db, ports.bound);
    if (usage.status === "held") {
      summary.usage = "held";
      return summary;
    }
    const { coverageId } = await ports.sync(db, ports.bound);
    const first = async (limit: number): Promise<void> => {
      const result = await ports.first(db, {
        binding: ports.bound.binding,
        workerId: ports.workerId,
        limit,
      });
      if (
        !Number.isInteger(result.claimed) ||
        result.claimed < 0 ||
        result.claimed > limit
      )
        throw new Error("invalid_first_batch_count");
      summary.first.claimed += result.claimed;
      summary.first.prepared += result.prepared;
      summary.first.held += result.held;
      summary.first.retry += result.retry;
    };
    await first(FIRST_SHARE);
    const firstShareFull = summary.first.claimed === FIRST_SHARE;
    if (coverageId) {
      const limit = MAX_BATCH - summary.first.claimed;
      const jobs = await ports.claimFollowUps(db, {
        connectionId: ports.bound.binding.connectionId,
        workerId: ports.workerId,
        limit,
      });
      if (jobs.length > limit) throw new Error("invalid_follow_up_batch_count");
      summary.followUp.claimed = jobs.length;
      for (const job of jobs) {
        const input = {
          jobId: job.id,
          leaseOwner: ports.workerId,
          leaseRevision: job.revision,
          connectionId: ports.bound.binding.connectionId,
          coverageId,
        };
        const result = await ports.prepareFollowUp(db, input);
        if (result.status === "ready") summary.followUp.prepared += 1;
        else {
          const state = await ports.settleFollowUp(db, {
            ...input,
            reason: result.reason,
          });
          summary.followUp[state] += 1;
        }
      }
    }
    const remaining =
      MAX_BATCH - summary.first.claimed - summary.followUp.claimed;
    if (remaining > 0 && firstShareFull) await first(remaining);
    return summary;
  };
}

export async function claimFollowUps(
  db: GrowthDb,
  input: FollowInput,
): Promise<FollowUpJob[]> {
  return withGrowthTransaction(
    db,
    async (tx) => tx<FollowUpJob[]>`
    with due as (
      select j.id from growth.outreach_jobs j join growth.campaign_memberships m on m.id=j.membership_id and m.campaign_id=j.campaign_id and m.policy_version=j.policy_version
      join growth.campaigns c on c.id=j.campaign_id and c.version=j.policy_version
      where j.job_type='follow_up' and c.account_connection_id=${input.connectionId}
        and j.idempotency_key in ('campaign-followup:'||m.id::text||':1','campaign-followup:'||m.id::text||':2')
        and j.due_at<=clock_timestamp() and (j.status='pending' or (j.status='leased' and j.lease_until<=clock_timestamp()))
      order by j.due_at,j.id for update of j skip locked limit ${input.limit}
    ) update growth.outreach_jobs j set status='leased',lease_owner=${input.workerId},lease_until=clock_timestamp()+interval '5 minutes',lease_revision=j.lease_revision+1
      from due where j.id=due.id returning j.id,j.lease_revision::text as revision`,
  );
}

export async function settleFollowUp(
  db: GrowthDb,
  input: PrepareInput & { reason: string },
): Promise<"retry" | "held" | "stale"> {
  if (input.reason === "job_lease_invalid") return "stale";
  const reason = SAFE_REASON.test(input.reason)
    ? input.reason
    : "preparation_unavailable";
  const retry = RETRYABLE_HOLDS.has(reason);
  return withGrowthTransaction(db, async (tx) => {
    const updated = await tx<{ id: string }[]>`
      update growth.outreach_jobs j set status=${retry ? "pending" : "held"},lease_until=null,last_error_code=${reason},
        due_at=case when ${retry} then clock_timestamp()+interval '15 minutes' else j.due_at end
      from growth.campaigns c where j.id=${input.jobId} and j.job_type='follow_up' and j.campaign_id=c.id and j.policy_version=c.version
        and c.account_connection_id=${input.connectionId} and j.status='leased' and j.lease_owner=${input.leaseOwner}
        and j.lease_revision=${input.leaseRevision}::bigint and j.lease_until>clock_timestamp() returning j.id`;
    return updated.length === 1 ? (retry ? "retry" : "held") : "stale";
  });
}

export function createLiveOutreachDueWorker(input: {
  bound: BoundGmailClient;
  founderEmail: string;
}) {
  return createOutreachDueWorker({
    bound: input.bound,
    workerId: randomUUID(),
    refreshUsage: (db, bound) =>
      refreshGmailUsage(db, { ...bound, subjectEmail: input.founderEmail }),
    sync: (db, bound) =>
      createGmailReplySync({
        repository: postgresGmailSyncRepository,
        gmailClient: bound.client,
        binding: bound.binding,
        founderEmail: input.founderEmail,
      })(db),
    first: runFirstPreparationBatch,
    claimFollowUps,
    prepareFollowUp,
    settleFollowUp,
  });
}
