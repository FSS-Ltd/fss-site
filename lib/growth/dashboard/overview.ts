import { randomUUID } from "node:crypto";

import { TZDate } from "@date-fns/tz";
import { addDays, setHours, setMilliseconds, setMinutes, setSeconds } from "date-fns";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import type { ProspectStatus } from "../db/repositories/prospects";
import type { ViewState } from "./view-models";

const TIMEZONE = "Europe/London";
const RESEARCH_RUN_HOUR = 6;
const MAX_WORK_QUEUE_ROWS = 6;
const MAX_UPCOMING_ACTIONS = 5;

export type WorkQueueKind = "first_emails" | "replies" | "follow_ups";

export type WorkQueueRow = {
  prospectId: string;
  businessName: string;
  websiteUrl: string | null;
  fitScore: number;
  offerFocus: string;
  status: ProspectStatus;
  statusAt: string;
  evidenceCount: number;
  potentialValuePence: number;
  reviewHref: string;
  overdue: boolean;
};

export type WorkQueueTab = {
  kind: WorkQueueKind;
  totalCount: number;
  rows: readonly WorkQueueRow[];
};

export type OverviewSummary = {
  emailsWaitingForApproval: number;
  repliesNeedingAttention: number;
  followUpsDueToday: number;
  nextResearchRunAt: string | null;
};

export type PipelineStageId = "new" | "qualified" | "proposal" | "negotiation";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  count: number;
  valuePence: number;
};

export type PipelineOverview = {
  totalValuePence: number;
  stages: readonly PipelineStage[];
};

export type UpcomingAction = {
  prospectId: string;
  businessName: string;
  actionLabel: string;
  status: ProspectStatus;
  dueAt: string;
};

export type SequenceHealth = {
  sentCount: number;
  failedCount: number;
  deliveryRate: number | null;
  repliedEnrollmentCount: number;
  sentEnrollmentCount: number;
  replyRate: number | null;
};

export type OverviewViewModel = {
  summary: OverviewSummary;
  workQueue: readonly WorkQueueTab[];
  defaultWorkQueueTab: WorkQueueKind;
  pipeline: PipelineOverview;
  upcomingActions: readonly UpcomingAction[];
  sequenceHealth: SequenceHealth;
};

export const PIPELINE_STAGES: readonly {
  id: PipelineStageId;
  label: string;
  statuses: readonly ProspectStatus[];
}[] = [
  {
    id: "new",
    label: "New",
    statuses: ["new", "researching", "needs_review", "ready_for_email_review"],
  },
  {
    id: "qualified",
    label: "Qualified",
    statuses: ["qualified", "contacted", "replied", "started_talks"],
  },
  { id: "proposal", label: "Proposal", statuses: ["proposal"] },
  { id: "negotiation", label: "Negotiation", statuses: ["negotiation"] },
];

type PipelineStatusCount = {
  status: string;
  count: number;
  valuePence: number;
};

export function buildPipelineOverview(
  statusCounts: readonly PipelineStatusCount[],
): PipelineOverview {
  const stages = PIPELINE_STAGES.map((stage) => {
    const rows = statusCounts.filter((row) =>
      (stage.statuses as readonly string[]).includes(row.status),
    );

    return {
      id: stage.id,
      label: stage.label,
      count: rows.reduce((sum, row) => sum + row.count, 0),
      valuePence: rows.reduce((sum, row) => sum + row.valuePence, 0),
    };
  });

  return {
    totalValuePence: stages.reduce((sum, stage) => sum + stage.valuePence, 0),
    stages,
  };
}

export function selectDefaultWorkQueueTab(
  tabs: readonly WorkQueueTab[],
): WorkQueueKind {
  const byKind = new Map(tabs.map((tab) => [tab.kind, tab]));
  const followUps = byKind.get("follow_ups");

  if (followUps?.rows.some((row) => row.overdue)) {
    return "follow_ups";
  }

  const firstEmails = byKind.get("first_emails");
  if (firstEmails && firstEmails.totalCount > 0) {
    return "first_emails";
  }

  const replies = byKind.get("replies");
  if (replies && replies.totalCount > 0) {
    return "replies";
  }

  if (followUps && followUps.totalCount > 0) {
    return "follow_ups";
  }

  return "first_emails";
}

export function nextResearchRunAt(
  lastRunDate: string | null,
  now: Date,
): string | null {
  if (!lastRunDate) return null;

  const [year, month, day] = lastRunDate.split("-").map(Number);
  const lastRunLocalMidnight = new TZDate(year ?? 0, (month ?? 1) - 1, day ?? 1, TIMEZONE);
  const candidate = setMilliseconds(
    setSeconds(setMinutes(setHours(addDays(lastRunLocalMidnight, 1), RESEARCH_RUN_HOUR), 0), 0),
    0,
  );

  const zonedNow = new TZDate(now, TIMEZONE);
  const result =
    candidate.getTime() <= zonedNow.getTime() ? addDays(candidate, 1) : candidate;

  return new Date(result.getTime()).toISOString();
}

function reviewHrefFor(kind: WorkQueueKind, row: FirstEmailRow | ReplyRow | FollowUpRow): string {
  if (kind === "first_emails") {
    const first = row as FirstEmailRow;
    return first.messageId
      ? `/growth/outreach/messages/${first.messageId}`
      : `/growth/prospects/${first.prospectId}`;
  }

  const withSequence = row as ReplyRow | FollowUpRow;
  return withSequence.sequenceEnrollmentId
    ? `/growth/outreach/sequences/${withSequence.sequenceEnrollmentId}`
    : `/growth/prospects/${withSequence.prospectId}`;
}

type BaseRow = {
  prospectId: string;
  businessName: string;
  websiteUrl: string | null;
  fitScore: number;
  offerFocus: string;
  status: ProspectStatus;
  evidenceCount: number;
  potentialValuePence: number;
  totalCount: number;
};

type FirstEmailRow = BaseRow & {
  statusAt: Date;
  messageId: string | null;
};

type ReplyRow = BaseRow & {
  statusAt: Date;
  sequenceEnrollmentId: string | null;
};

type FollowUpRow = BaseRow & {
  statusAt: Date;
  sequenceEnrollmentId: string | null;
};

function toWorkQueueTab(
  kind: WorkQueueKind,
  rows: readonly (FirstEmailRow | ReplyRow | FollowUpRow)[],
  now: Date,
): WorkQueueTab {
  return {
    kind,
    totalCount: rows[0]?.totalCount ?? 0,
    rows: rows.map((row) => ({
      prospectId: row.prospectId,
      businessName: row.businessName,
      websiteUrl: row.websiteUrl,
      fitScore: row.fitScore,
      offerFocus: row.offerFocus,
      status: row.status,
      statusAt: row.statusAt.toISOString(),
      evidenceCount: row.evidenceCount,
      potentialValuePence: row.potentialValuePence,
      reviewHref: reviewHrefFor(kind, row),
      overdue: kind === "follow_ups" && row.statusAt.getTime() < now.getTime(),
    })),
  };
}

async function fetchFirstEmailsTab(
  db: GrowthQueryExecutor,
  now: Date,
): Promise<WorkQueueTab> {
  const rows = await db<FirstEmailRow[]>`
    select
      p.id as "prospectId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      p.fit_score as "fitScore",
      p.recommended_offer as "offerFocus",
      p.status,
      p.updated_at as "statusAt",
      p.estimated_one_off_max_pence as "potentialValuePence",
      coalesce(evidence.count, 0)::int as "evidenceCount",
      draft.id as "messageId",
      count(*) over ()::int as "totalCount"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join lateral (
      select count(*)::int as count
      from growth.source_evidence se
      where se.prospect_id = p.id
    ) evidence on true
    left join lateral (
      select em.id
      from growth.email_messages em
      where em.prospect_id = p.id
        and em.step_number = 0
        and em.direction = 'outbound'
      order by em.created_at desc
      limit 1
    ) draft on true
    where p.status = 'ready_for_email_review'
    order by p.fit_score desc, p.updated_at desc
    limit ${MAX_WORK_QUEUE_ROWS}
  `;

  return toWorkQueueTab("first_emails", rows, now);
}

async function fetchRepliesTab(
  db: GrowthQueryExecutor,
  now: Date,
): Promise<WorkQueueTab> {
  const rows = await db<ReplyRow[]>`
    select
      p.id as "prospectId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      p.fit_score as "fitScore",
      p.recommended_offer as "offerFocus",
      p.status,
      reply.received_at as "statusAt",
      p.estimated_one_off_max_pence as "potentialValuePence",
      coalesce(evidence.count, 0)::int as "evidenceCount",
      reply.sequence_enrollment_id as "sequenceEnrollmentId",
      count(*) over ()::int as "totalCount"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join lateral (
      select count(*)::int as count
      from growth.source_evidence se
      where se.prospect_id = p.id
    ) evidence on true
    inner join lateral (
      select em.received_at, em.sequence_enrollment_id
      from growth.email_messages em
      where em.prospect_id = p.id
        and em.direction = 'inbound'
      order by em.received_at desc
      limit 1
    ) reply on true
    where p.status = 'replied'
    order by reply.received_at asc
    limit ${MAX_WORK_QUEUE_ROWS}
  `;

  return toWorkQueueTab("replies", rows, now);
}

async function fetchFollowUpsTab(
  db: GrowthQueryExecutor,
  now: Date,
): Promise<WorkQueueTab> {
  const rows = await db<FollowUpRow[]>`
    select
      p.id as "prospectId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      p.fit_score as "fitScore",
      p.recommended_offer as "offerFocus",
      p.status,
      em.scheduled_for as "statusAt",
      p.estimated_one_off_max_pence as "potentialValuePence",
      coalesce(evidence.count, 0)::int as "evidenceCount",
      em.sequence_enrollment_id as "sequenceEnrollmentId",
      count(*) over ()::int as "totalCount"
    from growth.email_messages em
    inner join growth.prospects p on p.id = em.prospect_id
    inner join growth.businesses b on b.id = p.business_id
    left join lateral (
      select count(*)::int as count
      from growth.source_evidence se
      where se.prospect_id = p.id
    ) evidence on true
    where em.direction = 'outbound'
      and em.step_number > 0
      and em.status in ('queued', 'retry')
      and em.scheduled_for is not null
      and (em.scheduled_for at time zone ${TIMEZONE})::date
        <= (${now} at time zone ${TIMEZONE})::date
    order by em.scheduled_for asc
    limit ${MAX_WORK_QUEUE_ROWS}
  `;

  return toWorkQueueTab("follow_ups", rows, now);
}

type SummaryCountsRow = { emailsWaitingForApproval: number; repliesNeedingAttention: number };

async function fetchSummaryCounts(
  db: GrowthQueryExecutor,
): Promise<SummaryCountsRow> {
  const rows = await db<SummaryCountsRow[]>`
    select
      count(*) filter (where p.status = 'ready_for_email_review')::int
        as "emailsWaitingForApproval",
      count(*) filter (where p.status = 'replied')::int
        as "repliesNeedingAttention"
    from growth.prospects p
  `;

  return rows[0] ?? { emailsWaitingForApproval: 0, repliesNeedingAttention: 0 };
}

async function fetchFollowUpsDueToday(
  db: GrowthQueryExecutor,
  now: Date,
): Promise<number> {
  const rows = await db<{ count: number }[]>`
    select count(*)::int as count
    from growth.email_messages
    where direction = 'outbound'
      and step_number > 0
      and status in ('queued', 'retry')
      and scheduled_for is not null
      and (scheduled_for at time zone ${TIMEZONE})::date
        = (${now} at time zone ${TIMEZONE})::date
  `;

  return rows[0]?.count ?? 0;
}

async function fetchLastResearchRunDate(
  db: GrowthQueryExecutor,
): Promise<string | null> {
  const rows = await db<{ lastRunDate: string | null }[]>`
    select max(run_date)::text as "lastRunDate"
    from growth.research_runs
  `;

  return rows[0]?.lastRunDate ?? null;
}

async function fetchPipelineStatusCounts(
  db: GrowthQueryExecutor,
): Promise<PipelineStatusCount[]> {
  return db<PipelineStatusCount[]>`
    select
      p.status,
      count(*)::int as "count",
      coalesce(sum(p.estimated_one_off_max_pence), 0)::int as "valuePence"
    from growth.prospects p
    where p.status not in ('won', 'lost', 'rejected', 'suppressed')
    group by p.status
  `;
}

async function fetchUpcomingActions(
  db: GrowthQueryExecutor,
): Promise<UpcomingAction[]> {
  const rows = await db<
    {
      prospectId: string;
      businessName: string;
      actionLabel: string;
      status: ProspectStatus;
      dueAt: Date;
    }[]
  >`
    select
      p.id as "prospectId",
      b.legal_name as "businessName",
      p.next_action as "actionLabel",
      p.status,
      p.next_action_due_at as "dueAt"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    where p.next_action is not null
      and p.next_action_due_at is not null
      and p.status not in ('won', 'lost', 'rejected', 'suppressed')
    order by p.next_action_due_at asc
    limit ${MAX_UPCOMING_ACTIONS}
  `;

  return rows.map((row) => ({
    prospectId: row.prospectId,
    businessName: row.businessName,
    actionLabel: row.actionLabel,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
  }));
}

export function buildSequenceHealth(input: {
  sentCount: number;
  failedCount: number;
  sentEnrollmentCount: number;
  repliedEnrollmentCount: number;
}): SequenceHealth {
  const deliveryDenominator = input.sentCount + input.failedCount;
  const deliveryRate =
    deliveryDenominator > 0 ? input.sentCount / deliveryDenominator : null;
  const replyRate =
    input.sentEnrollmentCount > 0
      ? input.repliedEnrollmentCount / input.sentEnrollmentCount
      : null;

  return {
    sentCount: input.sentCount,
    failedCount: input.failedCount,
    deliveryRate,
    repliedEnrollmentCount: input.repliedEnrollmentCount,
    sentEnrollmentCount: input.sentEnrollmentCount,
    replyRate,
  };
}

async function fetchSequenceHealth(
  db: GrowthQueryExecutor,
): Promise<SequenceHealth> {
  const [deliveryRows, enrollmentRows] = await Promise.all([
    db<{ sentCount: number; failedCount: number }[]>`
      select
        count(*) filter (where status = 'sent')::int as "sentCount",
        count(*) filter (where status = 'failed')::int as "failedCount"
      from growth.email_messages
      where direction = 'outbound'
    `,
    db<{ sentEnrollmentCount: number; repliedEnrollmentCount: number }[]>`
      select
        count(distinct sequence_enrollment_id)
          filter (where direction = 'outbound' and status = 'sent')::int
          as "sentEnrollmentCount",
        count(distinct sequence_enrollment_id)
          filter (where direction = 'inbound')::int
          as "repliedEnrollmentCount"
      from growth.email_messages
    `,
  ]);

  return buildSequenceHealth({
    sentCount: deliveryRows[0]?.sentCount ?? 0,
    failedCount: deliveryRows[0]?.failedCount ?? 0,
    sentEnrollmentCount: enrollmentRows[0]?.sentEnrollmentCount ?? 0,
    repliedEnrollmentCount: enrollmentRows[0]?.repliedEnrollmentCount ?? 0,
  });
}

export async function getOverviewViewModel(
  db: GrowthQueryExecutor = getGrowthDb(),
  now: () => Date = () => new Date(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<OverviewViewModel>> {
  const runAt = now();

  try {
    const [
      summaryCounts,
      followUpsDueToday,
      lastRunDate,
      firstEmails,
      replies,
      followUps,
      pipelineStatusCounts,
      upcomingActions,
      sequenceHealth,
    ] = await Promise.all([
      fetchSummaryCounts(db),
      fetchFollowUpsDueToday(db, runAt),
      fetchLastResearchRunDate(db),
      fetchFirstEmailsTab(db, runAt),
      fetchRepliesTab(db, runAt),
      fetchFollowUpsTab(db, runAt),
      fetchPipelineStatusCounts(db),
      fetchUpcomingActions(db),
      fetchSequenceHealth(db),
    ]);

    const workQueue = [firstEmails, replies, followUps];
    const pipeline = buildPipelineOverview(pipelineStatusCounts);

    const hasAnyData =
      workQueue.some((tab) => tab.totalCount > 0) ||
      pipeline.stages.some((stage) => stage.count > 0) ||
      upcomingActions.length > 0;

    if (!hasAnyData) {
      return {
        status: "empty",
        reason: "No prospects yet. Research runs will populate your work queue.",
      };
    }

    return {
      status: "ready",
      data: {
        summary: {
          emailsWaitingForApproval: summaryCounts.emailsWaitingForApproval,
          repliesNeedingAttention: summaryCounts.repliesNeedingAttention,
          followUpsDueToday,
          nextResearchRunAt: nextResearchRunAt(lastRunDate, runAt),
        },
        workQueue,
        defaultWorkQueueTab: selectDefaultWorkQueueTab(workQueue),
        pipeline,
        upcomingActions,
        sequenceHealth,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The founder dashboard could not load overview data.",
      correlationId: createCorrelationId(),
    };
  }
}
