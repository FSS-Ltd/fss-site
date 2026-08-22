import { randomUUID } from "node:crypto";

import {
  computeRate,
  currentLondonMonthKey,
  resolveLondonMonthRange,
  resolveUtcWindow,
  type LondonCalendarRange,
  type UtcWindow,
} from "../analytics/definitions";
import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import { OPEN_PIPELINE_STAGES } from "./pipeline";
import type { ViewState } from "./view-models";

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

// A literal SQL fragment, not a bound array: growth.delivery_engagements.stage
// is the growth.commercial_stage enum, and an enum column does not
// implicitly cast against a bound text[] parameter for "= any(...)" (see
// the same fix in lib/growth/dashboard/clients.ts). Built from the
// pipeline's own OPEN_PIPELINE_STAGES constant so the two can never drift
// apart - this is exactly the set of engagements getPipelineBoardResult
// treats as open.
const OPEN_PIPELINE_STAGE_SQL = `de.stage in (${OPEN_PIPELINE_STAGES.map((stage) => `'${stage}'`).join(", ")})`;

export type AnalyticsQuery = { month: string };

type RawSearchParams = Record<string, string | readonly string[] | undefined>;

function firstValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  return Array.isArray(value)
    ? (value[0] as string | undefined)
    : (value as string | undefined);
}

export function parseAnalyticsQuery(
  searchParams: RawSearchParams,
  now: Date,
): AnalyticsQuery {
  const raw = (firstValue(searchParams.month) ?? "").trim();
  return { month: MONTH_KEY_PATTERN.test(raw) ? raw : currentLondonMonthKey(now) };
}

export function shiftAnalyticsMonth(month: string, deltaMonths: 1 | -1): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const zeroIndexed = monthNumber - 1 + deltaMonths;
  const nextYear = year + Math.floor(zeroIndexed / 12);
  const nextMonth = ((zeroIndexed % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export type AnalyticsFunnel = {
  researchedProspects: number;
  approvedFirstEmails: number;
  replies: number;
  qualifiedOpportunities: number;
  proposals: number;
  wins: number;
};

export type AnalyticsValues = {
  openPipelineValuePence: number;
  agreedWonValuePence: number;
  completedDeliveryValuePence: number;
};

export type AnalyticsRates = {
  meetingsCount: number;
  replyRate: number | null;
  meetingRate: number | null;
  proposalRate: number | null;
  winRate: number | null;
};

export type AnalyticsResult = {
  month: string;
  range: LondonCalendarRange;
  funnel: AnalyticsFunnel;
  values: AnalyticsValues;
  rates: AnalyticsRates;
};

async function fetchFunnel(
  db: GrowthQueryExecutor,
  window: UtcWindow,
): Promise<AnalyticsFunnel> {
  const rows = await db<AnalyticsFunnel[]>`
    select
      (
        select count(*)::int from growth.prospects
        where created_at >= ${window.startUtc} and created_at < ${window.endUtc}
      ) as "researchedProspects",
      (
        select count(*)::int from growth.sequence_enrollments
        where created_at >= ${window.startUtc} and created_at < ${window.endUtc}
      ) as "approvedFirstEmails",
      (
        select count(distinct sequence_enrollment_id)::int from growth.email_messages
        where direction = 'inbound'
          and received_at >= ${window.startUtc} and received_at < ${window.endUtc}
      ) as "replies",
      (
        select count(distinct engagement_id)::int from growth.commercial_stage_events
        where dimension = 'commercial' and to_state = 'qualified'
          and occurred_at >= ${window.startUtc} and occurred_at < ${window.endUtc}
      ) as "qualifiedOpportunities",
      (
        select count(distinct engagement_id)::int from growth.commercial_stage_events
        where dimension = 'commercial' and to_state = 'proposal'
          and occurred_at >= ${window.startUtc} and occurred_at < ${window.endUtc}
      ) as "proposals",
      (
        select count(distinct engagement_id)::int from growth.commercial_stage_events
        where dimension = 'commercial' and to_state = 'won'
          and occurred_at >= ${window.startUtc} and occurred_at < ${window.endUtc}
      ) as "wins"
  `;

  return (
    rows[0] ?? {
      researchedProspects: 0,
      approvedFirstEmails: 0,
      replies: 0,
      qualifiedOpportunities: 0,
      proposals: 0,
      wins: 0,
    }
  );
}

async function fetchValues(
  db: GrowthQueryExecutor,
  window: UtcWindow,
): Promise<AnalyticsValues> {
  const rows = await db<AnalyticsValues[]>`
    select
      coalesce((
        select sum(coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0))::int
        from growth.delivery_engagements de
        where ${db.unsafe(OPEN_PIPELINE_STAGE_SQL)}
      ), 0) as "openPipelineValuePence",
      coalesce((
        select sum(coalesce(one_off_value_pence, 0) + coalesce(monthly_value_pence, 0))::int
        from growth.delivery_engagements
        where stage = 'won' and won_at >= ${window.startUtc} and won_at < ${window.endUtc}
      ), 0) as "agreedWonValuePence",
      coalesce((
        select sum(coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0))::int
        from growth.delivery_engagements de
        where exists (
          select 1 from growth.commercial_stage_events cse
          where cse.engagement_id = de.id
            and cse.dimension = 'delivery'
            and cse.to_state = 'complete'
            and cse.occurred_at >= ${window.startUtc} and cse.occurred_at < ${window.endUtc}
        )
      ), 0) as "completedDeliveryValuePence"
  `;

  return (
    rows[0] ?? {
      openPipelineValuePence: 0,
      agreedWonValuePence: 0,
      completedDeliveryValuePence: 0,
    }
  );
}

async function fetchMeetingsCount(
  db: GrowthQueryExecutor,
  window: UtcWindow,
): Promise<number> {
  const rows = await db<{ count: number }[]>`
    select count(distinct entity_id)::int as count
    from growth.audit_log
    where action = 'prospect.status_transitioned.started_talks'
      and entity_type = 'prospect'
      and created_at >= ${window.startUtc} and created_at < ${window.endUtc}
  `;
  return rows[0]?.count ?? 0;
}

function buildRates(funnel: AnalyticsFunnel, meetingsCount: number): AnalyticsRates {
  return {
    meetingsCount,
    replyRate: computeRate(funnel.replies, funnel.approvedFirstEmails),
    meetingRate: computeRate(meetingsCount, funnel.replies),
    proposalRate: computeRate(funnel.proposals, meetingsCount),
    winRate: computeRate(funnel.wins, funnel.proposals),
  };
}

export async function getAnalyticsResult(
  query: AnalyticsQuery,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<AnalyticsResult>> {
  try {
    const range = resolveLondonMonthRange(query.month);
    const window = resolveUtcWindow(range);

    const [funnel, values, meetingsCount] = await Promise.all([
      fetchFunnel(db, window),
      fetchValues(db, window),
      fetchMeetingsCount(db, window),
    ]);

    return {
      status: "ready",
      data: {
        month: query.month,
        range,
        funnel,
        values,
        rates: buildRates(funnel, meetingsCount),
      },
    };
  } catch {
    return {
      status: "error",
      message: "The analytics for this month could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
