import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getGrowthDb } from "../db/client";
import type { ProspectStatus } from "../db/repositories/prospects";
import type { GrowthQueryExecutor } from "../db/types";
import type { ViewState } from "./view-models";

const PAGE_SIZE = 20;

export const PROSPECT_STATUS_VALUES = [
  "new",
  "researching",
  "needs_review",
  "ready_for_email_review",
  "qualified",
  "contacted",
  "replied",
  "started_talks",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "rejected",
  "suppressed",
] as const satisfies readonly ProspectStatus[];

export const STATUS_FILTER_VALUES = ["all", ...PROSPECT_STATUS_VALUES] as const;
export type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];

export const FIT_SCORE_BAND_VALUES = ["all", "50", "70", "85"] as const;
export type FitScoreBand = (typeof FIT_SCORE_BAND_VALUES)[number];

export const OUTREACH_STATE_VALUES = [
  "all",
  "not_started",
  "active",
  "paused",
  "stopped",
  "completed",
] as const;
export type OutreachStateFilter = (typeof OUTREACH_STATE_VALUES)[number];

export const SUPPRESSION_FILTER_VALUES = ["all", "suppressed", "contactable"] as const;
export type SuppressionFilter = (typeof SUPPRESSION_FILTER_VALUES)[number];

export type ProspectListQuery = {
  q: string;
  sector: string;
  location: string;
  fitScoreMin: FitScoreBand;
  status: StatusFilter;
  outreach: OutreachStateFilter;
  suppressed: SuppressionFilter;
  after: string | null;
};

export type ProspectListRow = {
  prospectId: string;
  businessName: string;
  websiteUrl: string | null;
  sector: string;
  location: string;
  fitScore: number;
  opportunitySummary: string;
  recommendedOffer: string;
  status: ProspectStatus;
  outreachState: Exclude<OutreachStateFilter, "all">;
  potentialValuePence: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type ProspectFilterFacets = {
  sectors: readonly string[];
  locations: readonly string[];
};

export type ProspectListResult = {
  rows: readonly ProspectListRow[];
  totalCount: number;
  nextCursor: string | null;
  facets: ProspectFilterFacets;
};

const textParamSchema = z.string().trim().max(120);
const cursorParamSchema = z.string().trim().max(200);

type RawSearchParams = Record<string, string | readonly string[] | undefined>;

function firstValue(value: string | readonly string[] | undefined): string | undefined {
  return Array.isArray(value) ? (value[0] as string | undefined) : (value as string | undefined);
}

function parseEnumParam<const T extends readonly string[]>(
  values: T,
  raw: string | undefined,
): T[number] {
  const parsed = z.enum(values as unknown as [string, ...string[]]).safeParse(raw);
  return parsed.success ? (parsed.data as T[number]) : (values[0] as T[number]);
}

export function parseProspectListQuery(
  searchParams: RawSearchParams,
): ProspectListQuery {
  const q = textParamSchema.safeParse(firstValue(searchParams.q) ?? "");
  const sector = textParamSchema.safeParse(firstValue(searchParams.sector) ?? "");
  const location = textParamSchema.safeParse(firstValue(searchParams.location) ?? "");
  const after = cursorParamSchema.safeParse(firstValue(searchParams.after) ?? "");

  return {
    q: q.success ? q.data : "",
    sector: sector.success ? sector.data : "",
    location: location.success ? location.data : "",
    fitScoreMin: parseEnumParam(FIT_SCORE_BAND_VALUES, firstValue(searchParams.fitScoreMin)),
    status: parseEnumParam(STATUS_FILTER_VALUES, firstValue(searchParams.status)),
    outreach: parseEnumParam(OUTREACH_STATE_VALUES, firstValue(searchParams.outreach)),
    suppressed: parseEnumParam(SUPPRESSION_FILTER_VALUES, firstValue(searchParams.suppressed)),
    after: after.success && after.data.length > 0 ? after.data : null,
  };
}

type Cursor = { fitScore: number; prospectId: string };

export function encodeProspectCursor(fitScore: number, prospectId: string): string {
  return Buffer.from(`${fitScore}:${prospectId}`, "utf8").toString("base64url");
}

export function decodeProspectCursor(cursor: string): Cursor | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex <= 0) return null;

    const fitScore = Number(decoded.slice(0, separatorIndex));
    const prospectId = decoded.slice(separatorIndex + 1);

    if (!Number.isInteger(fitScore) || prospectId.length === 0) return null;
    return { fitScore, prospectId };
  } catch {
    return null;
  }
}

function buildFilterFragments(db: GrowthQueryExecutor, query: ProspectListQuery) {
  const search = query.q
    ? db`and (
        b.legal_name ilike ${`%${query.q}%`}
        or b.trading_name ilike ${`%${query.q}%`}
        or c.first_name ilike ${`%${query.q}%`}
        or c.last_name ilike ${`%${query.q}%`}
      )`
    : db``;

  const sector = query.sector ? db`and b.sector = ${query.sector}` : db``;
  const location = query.location ? db`and b.locality = ${query.location}` : db``;

  const fitScoreMin =
    query.fitScoreMin === "all" ? db`` : db`and p.fit_score >= ${Number(query.fitScoreMin)}`;

  const status = query.status === "all" ? db`` : db`and p.status = ${query.status}`;

  const outreach =
    query.outreach === "all"
      ? db``
      : db`and coalesce(seq.state, 'not_started') = ${query.outreach}`;

  const suppressed =
    query.suppressed === "all"
      ? db``
      : query.suppressed === "suppressed"
        ? db`and exists (
            select 1 from growth.suppressions s
            where s.normalised_email = c.normalised_email
          )`
        : db`and not exists (
            select 1 from growth.suppressions s
            where s.normalised_email = c.normalised_email
          )`;

  return { search, sector, location, fitScoreMin, status, outreach, suppressed };
}

const OUTREACH_STATE_CASE = `
  case
    when se.status = 'active' then 'active'
    when se.status = 'paused' then 'paused'
    when se.status = 'completed' then 'completed'
    when se.status like 'stopped_%' then 'stopped'
    else 'not_started'
  end
`;

async function fetchProspectRows(
  db: GrowthQueryExecutor,
  query: ProspectListQuery,
): Promise<{ rows: ProspectListRow[]; nextCursor: string | null }> {
  const fragments = buildFilterFragments(db, query);
  const cursor = query.after ? decodeProspectCursor(query.after) : null;
  const cursorFragment = cursor
    ? db`and (
        p.fit_score < ${cursor.fitScore}
        or (p.fit_score = ${cursor.fitScore} and p.id > ${cursor.prospectId})
      )`
    : db``;

  const rows = await db<
    (Omit<ProspectListRow, "nextActionDueAt"> & { nextActionDueAt: Date | null })[]
  >`
    select
      p.id as "prospectId",
      b.legal_name as "businessName",
      b.website_url as "websiteUrl",
      b.sector,
      b.locality as "location",
      p.fit_score as "fitScore",
      p.opportunity_summary as "opportunitySummary",
      p.recommended_offer as "recommendedOffer",
      p.status,
      p.estimated_one_off_max_pence as "potentialValuePence",
      p.next_action as "nextAction",
      p.next_action_due_at as "nextActionDueAt",
      coalesce(seq.state, 'not_started') as "outreachState"
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    left join lateral (
      select (${db.unsafe(OUTREACH_STATE_CASE)}) as state
      from growth.sequence_enrollments se
      where se.prospect_id = p.id
      order by se.created_at desc
      limit 1
    ) seq on true
    where true
      ${fragments.search}
      ${fragments.sector}
      ${fragments.location}
      ${fragments.fitScoreMin}
      ${fragments.status}
      ${fragments.outreach}
      ${fragments.suppressed}
      ${cursorFragment}
    order by p.fit_score desc, p.id asc
    limit ${PAGE_SIZE + 1}
  `;

  const hasNextPage = rows.length > PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page.at(-1);

  return {
    rows: page.map((row) => ({
      ...row,
      nextActionDueAt: row.nextActionDueAt ? row.nextActionDueAt.toISOString() : null,
    })),
    nextCursor: hasNextPage && last ? encodeProspectCursor(last.fitScore, last.prospectId) : null,
  };
}

async function fetchProspectTotalCount(
  db: GrowthQueryExecutor,
  query: ProspectListQuery,
): Promise<number> {
  const fragments = buildFilterFragments(db, query);

  const rows = await db<{ count: number }[]>`
    select count(*)::int as count
    from growth.prospects p
    inner join growth.businesses b on b.id = p.business_id
    left join growth.contacts c on c.id = p.primary_contact_id
    left join lateral (
      select (${db.unsafe(OUTREACH_STATE_CASE)}) as state
      from growth.sequence_enrollments se
      where se.prospect_id = p.id
      order by se.created_at desc
      limit 1
    ) seq on true
    where true
      ${fragments.search}
      ${fragments.sector}
      ${fragments.location}
      ${fragments.fitScoreMin}
      ${fragments.status}
      ${fragments.outreach}
      ${fragments.suppressed}
  `;

  return rows[0]?.count ?? 0;
}

async function fetchFilterFacets(db: GrowthQueryExecutor): Promise<ProspectFilterFacets> {
  const [sectorRows, locationRows] = await Promise.all([
    db<{ sector: string }[]>`
      select distinct b.sector
      from growth.businesses b
      inner join growth.prospects p on p.business_id = b.id
      order by b.sector
      limit 200
    `,
    db<{ locality: string }[]>`
      select distinct b.locality
      from growth.businesses b
      inner join growth.prospects p on p.business_id = b.id
      order by b.locality
      limit 200
    `,
  ]);

  return {
    sectors: sectorRows.map((row) => row.sector),
    locations: locationRows.map((row) => row.locality),
  };
}

export async function getProspectListResult(
  query: ProspectListQuery,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<ProspectListResult>> {
  try {
    const [{ rows, nextCursor }, totalCount, facets] = await Promise.all([
      fetchProspectRows(db, query),
      fetchProspectTotalCount(db, query),
      fetchFilterFacets(db),
    ]);

    return { status: "ready", data: { rows, totalCount, nextCursor, facets } };
  } catch {
    return {
      status: "error",
      message: "The prospect list could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
