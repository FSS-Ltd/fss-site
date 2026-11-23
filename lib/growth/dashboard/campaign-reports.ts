import { z } from "zod";
import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import {
  campaignReportSchema,
  type CampaignReport,
} from "../campaigns/schemas";
import {
  campaignMonthAnniversary,
  campaignSchedulingAnchor,
} from "../campaigns/time";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";

export type ReportSnapshot =
  | {
      status: "available";
      revision: number;
      current: boolean;
      generatedAt: string;
      report: CampaignReport;
      observedCoverage: number;
      version: 1 | 2;
      readAt: string | null;
    }
  | { status: "unavailable"; revision: number; current: boolean };
export type CampaignReportEntry = {
  id: string;
  name: string;
  job:
    | { status: "no_anchor" }
    | { status: "unavailable" }
    | {
        status: "scheduled" | "held" | "completed";
        dueAt: string;
        reason: string | null;
      };
  snapshots: ReportSnapshot[];
  truncated: boolean;
};
export type CampaignReportsResult =
  | { status: "ready"; campaigns: CampaignReportEntry[]; truncated: boolean }
  | { status: "unavailable" };

type Row = {
  id: string;
  name: string;
  jobId: string | null;
  jobStatus: string | null;
  jobDue: Date | null;
  jobReason: string | null;
  jobAnchorId: string | null;
  jobAnchorRevision: number | null;
  jobAnchorAt: Date | null;
  jobBasis: string | null;
  jobHasSubMillisecond: boolean | null;
  jobReceiptMatches: boolean;
  jobMembershipMatches: boolean;
  jobPolicyVersion: number | null;
  reportId: string | null;
  reportPolicyVersion: number | null;
  reportAnchorId: string | null;
  reportRevision: number | null;
  reportCutoff: Date | null;
  generatedAt: Date | null;
  reportAnchorAt: Date | null;
  reportBasis: string | null;
  reportHasSubMillisecond: boolean | null;
  reportReceiptMatches: boolean;
  reportMembershipMatches: boolean;
  reportWitnessIncluded: boolean;
  payload: unknown;
};
const payloadSchema = z.object({
  version: z.literal(1),
  sourceAvailabilityAtCutoff: z.literal("unknown"),
  sourceAvailabilityReason: z.literal("commit_time_unavailable"),
  outcomeSources: z.literal("unknown"),
  comparisonCopyIdentity: z.literal("unknown"),
  coverageCompleteObservedAtRead: z.number().int().nonnegative(),
  report: campaignReportSchema,
});
const v2PayloadSchema = z.object({
  version: z.literal(2),
  visibility: z.object({
    basis: z.literal("postgres_statement_snapshot"),
    snapshot: z
      .string()
      .min(1)
      .max(131072)
      .regex(/^\d+:\d+:(?:\d+(?:,\d+)*)?$/),
    readAt: z.iso.datetime({ offset: true }),
  }),
  sourceAvailabilityAtCutoff: z.literal("unknown"),
  sourceAvailabilityReason: z.literal("commit_time_unavailable"),
  outcomeSources: z.literal("unknown"),
  comparisonCopyIdentity: z.literal("frozen_when_available"),
  coverageCompleteObservedAtRead: z.number().int().nonnegative().safe(),
  report: campaignReportSchema,
});
const validDate = (value: Date | null): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
const basis = (value: string | null) =>
  value === "gmail_fss_sent_observed" ||
  value === "resend_fss_delivery_observed";

function validReport(report: CampaignReport): boolean {
  const counts = [
    "mature",
    "censored",
    "later",
    "positiveReplies",
    "knownPositiveReplies",
    "preAnchorPositiveReplies",
    "unknownOriginPositiveReplies",
    "qualifiedMeetings",
    "unknownOriginMeetings",
    "meetingMature",
    "meetingUnknown",
    "meetingCensored",
    "paymentMature",
    "paymentUnknown",
    "paymentCensored",
    "paidConversions",
    "unknownOriginPayments",
    "missingReplies",
  ] as const;
  if (report.groups.length > 50 || report.anchor.observedAt > report.cutoff)
    return false;
  if (
    report.winnerReason === "clear_interval"
      ? !report.winner ||
        !report.groups.some((g) => g.variantId === report.winner)
      : report.winner !== null
  )
    return false;
  return report.groups.every((group) => {
    if (
      !Number.isSafeInteger(group.policyVersion) ||
      group.policyVersion < 1 ||
      !Number.isSafeInteger(group.variantVersion) ||
      group.variantVersion < 1 ||
      counts.some(
        (key) => !Number.isSafeInteger(group[key]) || group[key] < 0,
      ) ||
      group.positiveReplies > group.mature
    )
      return false;
    const cohort = group.mature + group.censored + group.missingReplies;
    if (
      !Number.isSafeInteger(cohort) ||
      group.meetingMature + group.meetingUnknown + group.meetingCensored !==
        cohort ||
      group.paymentMature + group.paymentUnknown + group.paymentCensored !==
        cohort ||
      group.positiveReplies > group.knownPositiveReplies ||
      group.knownPositiveReplies + group.unknownOriginPositiveReplies >
        cohort ||
      group.preAnchorPositiveReplies > group.knownPositiveReplies ||
      group.qualifiedMeetings > cohort ||
      group.unknownOriginMeetings > cohort ||
      group.paidConversions > cohort ||
      group.unknownOriginPayments > cohort
    )
      return false;
    if (!group.mature)
      return group.positiveReplyRate === null && group.interval === null;
    if (group.positiveReplyRate === null || !group.interval) return false;
    const proportion = group.positiveReplies / group.mature;
    const z = 1.959963984540054;
    const denominator = 1 + (z * z) / group.mature;
    const center = (proportion + (z * z) / (2 * group.mature)) / denominator;
    const margin =
      (z *
        Math.sqrt(
          (proportion * (1 - proportion)) / group.mature +
            (z * z) / (4 * group.mature * group.mature),
        )) /
      denominator;
    return (
      Math.abs(group.positiveReplyRate - proportion) < 1e-10 &&
      Math.abs(group.interval[0] - Math.max(0, center - margin)) < 1e-10 &&
      Math.abs(group.interval[1] - Math.min(1, center + margin)) < 1e-10
    );
  });
}
function validModernWinner(report: CampaignReport): boolean {
  if (report.winnerReason !== "clear_interval") return report.winner === null;
  if (
    !report.winner ||
    report.ambiguousEvidence !== 0 ||
    report.groups.length !== 2
  )
    return false;
  const [a, b] = report.groups;
  if (
    !a ||
    !b ||
    a.variantId === b.variantId ||
    a.cta === b.cta ||
    !a.comparisonFingerprint ||
    !a.commercialTermsFingerprint ||
    a.basis !== report.anchor.basis ||
    b.basis !== report.anchor.basis ||
    a.market !== b.market ||
    a.offer !== b.offer ||
    a.policyVersion !== b.policyVersion ||
    a.variantVersion !== b.variantVersion ||
    a.comparisonFingerprint !== b.comparisonFingerprint ||
    a.commercialTermsFingerprint !== b.commercialTermsFingerprint ||
    [a, b].some(
      (group) =>
        group.mature < 30 ||
        group.censored !== 0 ||
        group.missingReplies !== 0 ||
        !group.interval,
    )
  )
    return false;
  if (!a.interval || !b.interval) return false;
  return (
    (report.winner === a.variantId && a.interval[0] > b.interval[1]) ||
    (report.winner === b.variantId && b.interval[0] > a.interval[1])
  );
}
function jobState(row: Row): CampaignReportEntry["job"] {
  if (!row.jobId) return { status: "no_anchor" };
  if (
    !row.jobAnchorId ||
    !row.jobAnchorRevision ||
    !Number.isSafeInteger(row.jobAnchorRevision) ||
    row.jobAnchorRevision < 1 ||
    !validDate(row.jobAnchorAt) ||
    !validDate(row.jobDue) ||
    !basis(row.jobBasis) ||
    typeof row.jobHasSubMillisecond !== "boolean" ||
    !row.jobReceiptMatches ||
    !row.jobMembershipMatches ||
    campaignMonthAnniversary(
      campaignSchedulingAnchor(
        row.jobAnchorAt,
        row.jobBasis,
        row.jobHasSubMillisecond,
      ),
    ).getTime() !== row.jobDue.getTime()
  )
    return { status: "unavailable" };
  const status =
    row.jobStatus === "held"
      ? "held"
      : row.jobStatus === "completed"
        ? "completed"
        : row.jobStatus === "pending" || row.jobStatus === "leased"
          ? "scheduled"
          : null;
  const reason =
    row.jobReason && /^[a-z][a-z0-9_]{0,99}$/.test(row.jobReason)
      ? row.jobReason
      : null;
  return status
    ? { status, dueAt: row.jobDue.toISOString(), reason }
    : { status: "unavailable" };
}
function snapshot(row: Row): ReportSnapshot | null {
  if (!row.reportId || !row.reportRevision) return null;
  const current = row.reportRevision === row.jobAnchorRevision;
  const unavailable: ReportSnapshot = {
    status: "unavailable",
    revision: row.reportRevision,
    current,
  };
  if (
    !row.jobAnchorRevision ||
    !Number.isSafeInteger(row.reportRevision) ||
    row.reportRevision < 1 ||
    row.reportRevision > row.jobAnchorRevision ||
    !row.reportAnchorId ||
    !validDate(row.reportAnchorAt) ||
    !validDate(row.reportCutoff) ||
    !validDate(row.generatedAt) ||
    (validDate(row.reportCutoff) && row.generatedAt < row.reportCutoff) ||
    !basis(row.reportBasis) ||
    typeof row.reportHasSubMillisecond !== "boolean" ||
    !row.reportReceiptMatches ||
    !row.reportMembershipMatches ||
    !row.reportWitnessIncluded ||
    (current &&
      (row.reportAnchorId !== row.jobAnchorId ||
        row.reportPolicyVersion !== row.jobPolicyVersion ||
        row.reportCutoff.getTime() !== row.jobDue?.getTime()))
  )
    return unavailable;
  const legacy = payloadSchema.safeParse(row.payload);
  const modern = v2PayloadSchema.safeParse(row.payload);
  if (!legacy.success && !modern.success) return unavailable;
  const data = legacy.success
    ? legacy.data
    : modern.success
      ? modern.data
      : null;
  if (
    !data ||
    !validReport(data.report) ||
    data.report.anchor.basis !== row.reportBasis ||
    data.report.anchor.observedAt.getTime() !== row.reportAnchorAt.getTime() ||
    data.report.cutoff.getTime() !== row.reportCutoff.getTime() ||
    campaignMonthAnniversary(
      campaignSchedulingAnchor(
        row.reportAnchorAt,
        row.reportBasis,
        row.reportHasSubMillisecond,
      ),
    ).getTime() !== row.reportCutoff.getTime()
  )
    return unavailable;
  if (
    legacy.success &&
    (data.report.winner !== null ||
      data.report.winnerReason === "clear_interval")
  )
    return unavailable;
  if (modern.success) {
    const readAt = new Date(modern.data.visibility.readAt);
    if (
      !Number.isFinite(readAt.getTime()) ||
      readAt < row.reportCutoff ||
      readAt > row.generatedAt ||
      modern.data.coverageCompleteObservedAtRead <
        data.report.groups.reduce((total, group) => total + group.mature, 0) ||
      !validModernWinner(data.report)
    )
      return unavailable;
  }
  return {
    status: "available",
    revision: row.reportRevision,
    current,
    generatedAt: row.generatedAt.toISOString(),
    report: data.report,
    observedCoverage: data.coverageCompleteObservedAtRead,
    version: data.version,
    readAt: modern.success ? modern.data.visibility.readAt : null,
  };
}

// Founder-only, bounded snapshot projection. It does not generate reports or read live policy as evidence.
export async function getCampaignReports(
  founder: FounderSession,
  db: GrowthQueryExecutor = getGrowthDb(),
): Promise<CampaignReportsResult> {
  requireCampaignFounder(founder);
  try {
    const rows = await db<Row[]>`
      with selected as materialized (
        select * from (select distinct on (id) id,name from growth.campaigns order by id,version desc) latest
        order by name,id limit 51
      )
      select c.id,c.name,j.id as "jobId",j.status as "jobStatus",j.due_at as "jobDue",j.last_error_code as "jobReason",
        j.anchor_reservation_id as "jobAnchorId",j.anchor_revision as "jobAnchorRevision",j.policy_version as "jobPolicyVersion",
        ar.confirmation_observed_at as "jobAnchorAt",ar.confirmation_receipt->>'basis' as "jobBasis",
        (ar.confirmation_observed_at <> date_trunc('milliseconds',ar.confirmation_observed_at)) as "jobHasSubMillisecond",
        (am.id is not null) as "jobMembershipMatches",
        case
          when ar.confirmation_receipt->>'basis'='gmail_fss_sent_observed' and pg_input_is_valid(ar.confirmation_receipt->>'observedUntil','timestamp with time zone')
            then (ar.confirmation_receipt->>'observedUntil')::timestamptz=ar.confirmation_observed_at
          when ar.confirmation_receipt->>'basis'='resend_fss_delivery_observed' and pg_input_is_valid(ar.confirmation_receipt->>'observedAt','timestamp with time zone')
            then (ar.confirmation_receipt->>'observedAt')::timestamptz=ar.confirmation_observed_at
          else false end as "jobReceiptMatches",
        s.id as "reportId",s.policy_version as "reportPolicyVersion",s.anchor_reservation_id as "reportAnchorId",
        s.anchor_revision as "reportRevision",s.report_cutoff as "reportCutoff",s.generated_at as "generatedAt",
        sr.confirmation_observed_at as "reportAnchorAt",sr.confirmation_receipt->>'basis' as "reportBasis",
        (sr.confirmation_observed_at <> date_trunc('milliseconds',sr.confirmation_observed_at)) as "reportHasSubMillisecond",
        (sm.id is not null) as "reportMembershipMatches",
        coalesce(jsonb_typeof(s.evidence->'sources'->'receiptIds')='array' and (s.evidence->'sources'->'receiptIds') ? s.anchor_reservation_id::text,false) as "reportWitnessIncluded",
        case
          when sr.confirmation_receipt->>'basis'='gmail_fss_sent_observed' and pg_input_is_valid(sr.confirmation_receipt->>'observedUntil','timestamp with time zone')
            then (sr.confirmation_receipt->>'observedUntil')::timestamptz=sr.confirmation_observed_at
          when sr.confirmation_receipt->>'basis'='resend_fss_delivery_observed' and pg_input_is_valid(sr.confirmation_receipt->>'observedAt','timestamp with time zone')
            then (sr.confirmation_receipt->>'observedAt')::timestamptz=sr.confirmation_observed_at
          else false end as "reportReceiptMatches",
        case when octet_length(s.evidence::text)<=1048576 then s.evidence - 'sources' - 'jobLease' - 'lateReviewedPositives' else null end as payload
      from selected c
      left join growth.outreach_jobs j on j.campaign_id=c.id and j.job_type='monthly_report' and j.membership_id is null
      left join growth.outreach_reservations ar on ar.id=j.anchor_reservation_id and ar.campaign_id=c.id and ar.policy_version=j.policy_version
      left join growth.campaign_memberships am on am.id=ar.membership_id and am.first_confirmation_reservation_id=ar.id and am.campaign_id=c.id and am.policy_version=j.policy_version
      left join lateral (
        select id,policy_version,anchor_reservation_id,anchor_revision,report_cutoff,generated_at,evidence
        from growth.experiment_reviews where generation_kind='scheduled_report' and report_job_id=j.id and campaign_id=c.id
        order by anchor_revision desc limit 4
      ) s on true
      left join growth.outreach_reservations sr on sr.id=s.anchor_reservation_id and sr.campaign_id=c.id and sr.policy_version=s.policy_version
      left join growth.campaign_memberships sm on sm.id=sr.membership_id and sm.first_confirmation_reservation_id=sr.id and sm.campaign_id=c.id and sm.policy_version=s.policy_version
      order by c.name,c.id,s.anchor_revision desc
    `;
    const campaigns = new Map<string, CampaignReportEntry>();
    for (const row of rows) {
      let entry = campaigns.get(row.id);
      if (!entry) {
        entry = {
          id: row.id,
          name: row.name,
          job: jobState(row),
          snapshots: [],
          truncated: false,
        };
        campaigns.set(row.id, entry);
      }
      const item = snapshot(row);
      if (item) {
        if (entry.snapshots.length < 3) entry.snapshots.push(item);
        else entry.truncated = true;
      }
    }
    const list = [...campaigns.values()];
    for (const entry of list)
      if (
        entry.job.status === "completed" &&
        !entry.snapshots.some(
          (item) => item.current && item.status === "available",
        )
      )
        entry.job = { status: "unavailable" };
    return {
      status: "ready",
      campaigns: list.slice(0, 50),
      truncated: list.length > 50,
    };
  } catch {
    return { status: "unavailable" };
  }
}
