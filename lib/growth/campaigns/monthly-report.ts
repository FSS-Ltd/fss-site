import { randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import { loadReportEvidence } from "./report-evidence";
import { buildCampaignReport } from "./report";
import { campaignMonthAnniversary, campaignSchedulingAnchor } from "./time";
import { held, type ReservationOutcome } from "./reservation-shared";

const fenceSchema = z.strictObject({
  jobId: z.uuid(),
  leaseOwner: z.string().trim().min(1).max(256),
  leaseRevision: z.string().regex(/^[1-9][0-9]*$/),
  anchorRevision: z.number().int().positive(),
  anchorReservationId: z.uuid(),
});
type Fence = z.infer<typeof fenceSchema>;
type Result = { reportId: string; replay: boolean };

export async function publishMonthlyReport(
  db: GrowthDb,
  raw: Fence,
): Promise<ReservationOutcome<Result>> {
  const parsed = fenceSchema.safeParse(raw);
  if (!parsed.success) return held("invalid_input");
  const input = parsed.data;
  return withGrowthTransaction(db, async (tx) => {
    await lockGmailRouting(tx);
    const [identity] = await tx<
      { campaignId: string }[]
    >`select campaign_id as "campaignId" from growth.outreach_jobs where id=${input.jobId} and job_type='monthly_report' and membership_id is null`;
    if (!identity?.campaignId) return held("job_unavailable");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:campaign:${identity.campaignId}`},0))`;
    const [job] = await tx<
      {
        status: string;
        owner: string | null;
        revision: string;
        valid: boolean;
        policyVersion: number;
        due: Date;
        anchorId: string;
        anchorRevision: number;
        observedAt: Date | null;
        basis: string | null;
        hasSubMillisecond: boolean;
      }[]
    >`
      select j.status,j.lease_owner as owner,j.lease_revision::text as revision,
        coalesce(j.lease_until>clock_timestamp() and j.due_at<=clock_timestamp(),false) as valid,
        j.policy_version as "policyVersion",j.due_at as due,j.anchor_reservation_id as "anchorId",
        j.anchor_revision as "anchorRevision",r.confirmation_observed_at as "observedAt",r.confirmation_receipt->>'basis' as basis,
        r.confirmation_observed_at <> date_trunc('milliseconds',r.confirmation_observed_at) as "hasSubMillisecond"
      from growth.outreach_jobs j left join growth.outreach_reservations r on r.id=j.anchor_reservation_id
      where j.id=${input.jobId} and j.campaign_id=${identity.campaignId} and j.job_type='monthly_report' and j.membership_id is null for update of j`;
    if (
      !job ||
      job.owner !== input.leaseOwner ||
      job.revision !== input.leaseRevision ||
      job.anchorId !== input.anchorReservationId ||
      job.anchorRevision !== input.anchorRevision
    )
      return held("job_lease_invalid");
    const [existing] = await tx<
      { id: string }[]
    >`select id from growth.experiment_reviews where generation_kind='scheduled_report' and report_job_id=${input.jobId} and anchor_revision=${input.anchorRevision}`;
    if (existing)
      return job.status === "completed"
        ? { status: "ready", value: { reportId: existing.id, replay: true } }
        : held("snapshot_job_conflict");
    if (
      job.status !== "leased" ||
      !job.valid ||
      !job.observedAt ||
      campaignMonthAnniversary(
        campaignSchedulingAnchor(
          job.observedAt,
          job.basis,
          job.hasSubMillisecond,
        ),
      ).getTime() !== job.due.getTime()
    )
      return held("job_lease_invalid");
    const evidence = await loadReportEvidence(tx, identity.campaignId, job.due);
    const anchor = evidence.members.find(
      (member) =>
        member.confirmation.observedAt.getTime() ===
          job.observedAt?.getTime() &&
        member.confirmation.basis === "gmail_fss_sent_observed",
    );
    // The selected reservation itself, not merely another receipt with the same time, must be proven.
    const [proof] = await tx<
      { membershipId: string }[]
    >`select r.membership_id as "membershipId" from growth.outreach_reservations r join growth.campaign_memberships m on m.id=r.membership_id and m.first_confirmation_reservation_id=r.id and m.campaign_id=r.campaign_id and m.policy_version=r.policy_version where r.id=${input.anchorReservationId} and r.campaign_id=${identity.campaignId} and r.policy_version=${job.policyVersion}`;
    if (
      !anchor ||
      !proof ||
      !evidence.members.some(
        (member) =>
          member.membershipId === proof.membershipId &&
          member.confirmation.observedAt.getTime() ===
            job.observedAt?.getTime(),
      ) ||
      evidence.unsupported ||
      evidence.members.some(
        (member) => member.confirmation.observedAt < job.observedAt!,
      )
    )
      return held("report_evidence_unknown");
    const report = buildCampaignReport({
      anchor: { basis: "gmail_fss_sent_observed", observedAt: job.observedAt },
      cutoff: job.due,
      members: evidence.members,
    });
    const [previous] = await tx<
      { id: string }[]
    >`select id from growth.experiment_reviews where report_job_id=${input.jobId} and generation_kind='scheduled_report' and anchor_revision<${input.anchorRevision} order by anchor_revision desc limit 1`;
    const reportId = randomUUID();
    const payload = {
      version: 1,
      jobLease: { owner: input.leaseOwner, revision: input.leaseRevision },
      sourceAvailabilityAtCutoff: "unknown",
      sourceAvailabilityReason: "commit_time_unavailable",
      outcomeSources: "unknown",
      coverageCompleteObservedAtRead: evidence.observedCompleteAtRead,
      sources: {
        receiptIds: evidence.sourceReceiptIds,
        replyIds: evidence.sourceReplyIds,
        coverageIds: evidence.sourceCoverageIds,
      },
      lateReviewedPositives: evidence.lateReviewedPositives,
      comparisonCopyIdentity: "unknown",
      report,
    };
    await tx`insert into growth.experiment_reviews(id,campaign_id,policy_version,reviewed_by,reviewed_at,evidence,generation_kind,report_job_id,anchor_reservation_id,anchor_revision,report_cutoff,generated_at,supersedes_id)
      values (${reportId},${identity.campaignId},${job.policyVersion},null,null,${tx.json(JSON.parse(JSON.stringify(payload)))},'scheduled_report',${input.jobId},${input.anchorReservationId},${input.anchorRevision},${job.due},clock_timestamp(),${previous?.id ?? null})`;
    const [completed] = await tx<
      { id: string }[]
    >`update growth.outreach_jobs set status='completed',lease_until=null where id=${input.jobId} and status='leased' and lease_owner=${input.leaseOwner} and lease_revision=${input.leaseRevision}::bigint and anchor_revision=${input.anchorRevision} and anchor_reservation_id=${input.anchorReservationId} and lease_until>clock_timestamp() returning id`;
    if (!completed) throw new Error("report_lease_expired");
    const event = randomUUID();
    await tx`insert into growth.outreach_events(id,campaign_id,policy_version,membership_id,event_type) values (${event},${identity.campaignId},${job.policyVersion},null,'monthly_report_generated')`;
    await tx`insert into growth.outreach_outbox(id,event_id) values (${randomUUID()},${event})`;
    await appendAuditEvent(tx, {
      correlationId: reportId,
      actorType: "system",
      actorId: "outreach-monthly-report",
      action: "campaign.monthly_report_generated",
      entityType: "campaign",
      entityId: identity.campaignId,
    });
    return { status: "ready", value: { reportId, replay: false } };
  });
}
