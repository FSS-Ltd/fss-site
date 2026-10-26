import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parsePipelineFilters, pipelineHref } from "../crm/pipeline-query";
import { pipelineFiltersSchema, type PipelineFilters } from "../crm/schemas";

import { getGrowthDb } from "../db/client";
import type { GrowthQueryExecutor } from "../db/types";
import type { ViewState } from "./view-models";

const STAGE_PAGE_SIZE = 20;

// Won and lost never appear on the open pipeline board: forecast value stays
// separate from recognised revenue, and a closed engagement belongs to the
// Deals/Clients views (Tasks 4/5), not this one.
export const OPEN_PIPELINE_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
] as const;
export type OpenPipelineStage = (typeof OPEN_PIPELINE_STAGES)[number];

export type PipelineCardRow = {
  engagementId: string;
  version: number;
  prospectId: string;
  businessName: string;
  primaryContactName: string | null;
  offerFocus: string;
  stage: OpenPipelineStage;
  estimatedValuePence: number;
  oneOffValuePence: number;
  monthlyValuePence: number;
  probabilityPercent: number;
  expectedCloseDate: string | null;
  sector: string;
  location: string;
  lastActivityAt: string;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type PipelineColumn = {
  stage: OpenPipelineStage;
  rows: readonly PipelineCardRow[];
  totalCount: number;
  valueTotalPence: number;
  oneOffTotalPence: number;
  monthlyTotalPence: number;
  weightedOneOffPence: number;
  weightedMonthlyPence: number;
  nextCursor: string | null;
};

export type PipelineBoardResult = {
  columns: Record<OpenPipelineStage, PipelineColumn>;
};

export type PipelineBoardQuery = {
  after: Partial<Record<OpenPipelineStage, string>>;
  filters?: PipelineFilters;
};

type RawSearchParams = Record<string, string | readonly string[] | undefined>;

function firstValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  return Array.isArray(value)
    ? (value[0] as string | undefined)
    : (value as string | undefined);
}

export function parsePipelineBoardQuery(
  searchParams: RawSearchParams,
): PipelineBoardQuery {
  const after: Partial<Record<OpenPipelineStage, string>> = {};

  for (const stage of OPEN_PIPELINE_STAGES) {
    const raw = firstValue(searchParams[`after_${stage}`]);
    if (raw && raw.trim().length > 0 && raw.length <= 400) {
      after[stage] = raw.trim();
    }
  }

  const filters = parsePipelineFilters(searchParams);
  const defaults = pipelineFiltersSchema.parse({});
  return Object.keys(defaults).some(
    (key) =>
      filters[key as keyof PipelineFilters] !==
      defaults[key as keyof PipelineFilters],
  )
    ? { after, filters }
    : { after };
}

export function buildPipelineBoardHref(
  query: PipelineBoardQuery,
  overrides: Partial<Record<OpenPipelineStage, string>>,
): string {
  return pipelineHref(
    query.filters ?? pipelineFiltersSchema.parse({}),
    {},
    { ...query.after, ...overrides },
  );
}

type Cursor = {
  nextActionSortValue: string;
  updatedAt: string;
  engagementId: string;
};

// Postgres accepts "infinity" as a special timestamptz value that sorts
// after every real timestamp, so a null next_action_due_at can share the
// same ordering and cursor comparison as a real one without a separate
// null-handling branch.
const NEXT_ACTION_SORT_INFINITY = "infinity";

export function encodePipelineCursor(row: PipelineCardRow): string {
  const cursor: Cursor = {
    nextActionSortValue: row.nextActionDueAt ?? NEXT_ACTION_SORT_INFINITY,
    updatedAt: row.lastActivityAt,
    engagementId: row.engagementId,
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodePipelineCursor(value: string): Cursor | null {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    const parsed = z
      .object({
        nextActionSortValue: z.union([
          z.literal("infinity"),
          z.iso.datetime({ offset: true }),
        ]),
        updatedAt: z.iso.datetime({ offset: true }),
        engagementId: z
          .string()
          .regex(
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
          ),
      })
      .safeParse(decoded);
    if (parsed.success) return parsed.data;
    return null;
  } catch {
    return null;
  }
}

// postgres.js serializes a `::timestamptz`-cast parameter by constructing a
// JS Date and calling toISOString() on it. JS's Date parser doesn't
// recognise Postgres's special "infinity" value, so binding the sentinel as
// a normal parameter throws a RangeError; it has to be injected as raw SQL
// instead, matching the existing db.unsafe() fragment pattern used for the
// outreach-state CASE expression in prospects.ts.
function sortValueFragment(db: GrowthQueryExecutor, value: string) {
  return value === NEXT_ACTION_SORT_INFINITY
    ? db.unsafe("'infinity'::timestamptz")
    : db`${value}::text::timestamptz`;
}

function pipelineFilterFragment(
  db: GrowthQueryExecutor,
  filters: PipelineFilters,
) {
  const search = filters.q
    ? db`and (b.legal_name ilike ${`%${filters.q}%`} or b.trading_name ilike ${`%${filters.q}%`} or de.name ilike ${`%${filters.q}%`} or c.first_name ilike ${`%${filters.q}%`} or c.last_name ilike ${`%${filters.q}%`})`
    : db``;
  const stage =
    filters.stage === "all" ? db`` : db`and de.stage=${filters.stage}`;
  const sector = filters.sector ? db`and b.sector=${filters.sector}` : db``;
  const location = filters.location
    ? db`and b.locality=${filters.location}`
    : db``;
  const nextAction =
    filters.nextAction === "all"
      ? db``
      : filters.nextAction === "missing"
        ? db`and (p.next_action is null or p.next_action_due_at is null)`
        : filters.nextAction === "overdue"
          ? db`and p.next_action_due_at < now()`
          : db`and p.next_action_due_at >= now()`;
  return db`${search} ${stage} ${sector} ${location} ${nextAction}`;
}

async function fetchPipelineColumn(
  db: GrowthQueryExecutor,
  stage: OpenPipelineStage,
  afterCursorValue: string | undefined,
  filters: PipelineFilters,
): Promise<PipelineColumn> {
  const filterFragment = pipelineFilterFragment(db, filters);
  const cursor = afterCursorValue
    ? decodePipelineCursor(afterCursorValue)
    : null;
  const cursorFragment = cursor
    ? (() => {
        const sortValue = sortValueFragment(db, cursor.nextActionSortValue);
        return db`and (
          coalesce(p.next_action_due_at, 'infinity') > ${sortValue}
          or (
            coalesce(p.next_action_due_at, 'infinity') = ${sortValue}
            and de.updated_at < ${cursor.updatedAt}::text::timestamptz
          )
          or (
            coalesce(p.next_action_due_at, 'infinity') = ${sortValue}
            and de.updated_at = ${cursor.updatedAt}::text::timestamptz
            and de.id > ${cursor.engagementId}
          )
        )`;
      })()
    : db``;

  const [rows, aggregateRows] = await Promise.all([
    db<
      (Omit<PipelineCardRow, "lastActivityAt" | "nextActionDueAt"> & {
        lastActivityAt: Date;
        cursorUpdatedAt: string;
        cursorNextAction: string | null;
        nextActionDueAt: Date | null;
      })[]
    >`
      select
        de.id as "engagementId",
        de.version,
        de.prospect_id as "prospectId",
        b.legal_name as "businessName",
        c.first_name || ' ' || c.last_name as "primaryContactName",
        de.name as "offerFocus",
        de.stage,
        coalesce(de.one_off_value_pence,0) as "oneOffValuePence",
        coalesce(de.monthly_value_pence,0) as "monthlyValuePence",
        de.probability_percent as "probabilityPercent",
        de.expected_close_date::text as "expectedCloseDate",
        b.sector, b.locality as location,
        (coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)) as "estimatedValuePence",
        de.updated_at as "lastActivityAt",
        to_char(de.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorUpdatedAt",
        to_char(p.next_action_due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "cursorNextAction",
        p.next_action as "nextAction",
        p.next_action_due_at as "nextActionDueAt"
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      left join growth.contacts c on c.id = p.primary_contact_id
      where de.stage = ${stage}
        and de.prospect_id is not null
        ${filterFragment}
        ${cursorFragment}
      order by coalesce(p.next_action_due_at, 'infinity') asc, de.updated_at desc, de.id asc
      limit ${STAGE_PAGE_SIZE + 1}
    `,
    db<
      {
        totalCount: number;
        valueTotalPence: number;
        oneOffTotalPence: number;
        monthlyTotalPence: number;
        weightedOneOffPence: number;
        weightedMonthlyPence: number;
      }[]
    >`
      select
        count(*)::int as "totalCount",
        coalesce(
          sum(coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)),
          0
        )::float8 as "valueTotalPence",
        coalesce(sum(de.one_off_value_pence),0)::float8 as "oneOffTotalPence",
        coalesce(sum(de.monthly_value_pence),0)::float8 as "monthlyTotalPence",
        coalesce(sum(round(coalesce(de.one_off_value_pence,0)::numeric*de.probability_percent/100)),0)::float8 as "weightedOneOffPence",
        coalesce(sum(round(coalesce(de.monthly_value_pence,0)::numeric*de.probability_percent/100)),0)::float8 as "weightedMonthlyPence"
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id=de.prospect_id
      inner join growth.businesses b on b.id=p.business_id
      left join growth.contacts c on c.id=p.primary_contact_id
      where de.stage = ${stage}
        and de.prospect_id is not null
        ${filterFragment}
    `,
  ]);

  const hasNextPage = rows.length > STAGE_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, STAGE_PAGE_SIZE) : rows;
  const shapedRows = page.map((row) => ({
    ...row,
    lastActivityAt: row.lastActivityAt.toISOString(),
    nextActionDueAt: row.nextActionDueAt
      ? row.nextActionDueAt.toISOString()
      : null,
  }));
  const last = page.at(-1);

  return {
    stage,
    rows: shapedRows,
    totalCount: aggregateRows[0]?.totalCount ?? 0,
    valueTotalPence: aggregateRows[0]?.valueTotalPence ?? 0,
    oneOffTotalPence: aggregateRows[0]?.oneOffTotalPence ?? 0,
    monthlyTotalPence: aggregateRows[0]?.monthlyTotalPence ?? 0,
    weightedOneOffPence: aggregateRows[0]?.weightedOneOffPence ?? 0,
    weightedMonthlyPence: aggregateRows[0]?.weightedMonthlyPence ?? 0,
    nextCursor:
      hasNextPage && last
        ? encodePipelineCursor({
            ...shapedRows[shapedRows.length - 1],
            lastActivityAt: last.cursorUpdatedAt,
            nextActionDueAt: last.cursorNextAction,
          })
        : null,
  };
}

export async function getPipelineBoardResult(
  query: PipelineBoardQuery,
  db: GrowthQueryExecutor = getGrowthDb(),
  createCorrelationId: () => string = () => randomUUID(),
): Promise<ViewState<PipelineBoardResult>> {
  try {
    const columns = await Promise.all(
      OPEN_PIPELINE_STAGES.map((stage) =>
        fetchPipelineColumn(
          db,
          stage,
          query.after[stage],
          query.filters ?? pipelineFiltersSchema.parse({}),
        ),
      ),
    );

    return {
      status: "ready",
      data: {
        columns: Object.fromEntries(
          columns.map((column) => [column.stage, column]),
        ) as Record<OpenPipelineStage, PipelineColumn>,
      },
    };
  } catch {
    return {
      status: "error",
      message: "The pipeline board could not load.",
      correlationId: createCorrelationId(),
    };
  }
}
