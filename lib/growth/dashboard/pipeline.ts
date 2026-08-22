import { randomUUID } from "node:crypto";

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
  lastActivityAt: string;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type PipelineColumn = {
  stage: OpenPipelineStage;
  rows: readonly PipelineCardRow[];
  totalCount: number;
  valueTotalPence: number;
  nextCursor: string | null;
};

export type PipelineBoardResult = {
  columns: Record<OpenPipelineStage, PipelineColumn>;
};

export type PipelineBoardQuery = {
  after: Partial<Record<OpenPipelineStage, string>>;
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

  return { after };
}

export function buildPipelineBoardHref(
  query: PipelineBoardQuery,
  overrides: Partial<Record<OpenPipelineStage, string>>,
): string {
  const merged = { ...query.after, ...overrides };
  const params = new URLSearchParams();

  for (const stage of OPEN_PIPELINE_STAGES) {
    const value = merged[stage];
    if (value) params.set(`after_${stage}`, value);
  }

  const queryString = params.toString();
  return queryString ? `/growth/pipeline?${queryString}` : "/growth/pipeline";
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
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof (decoded as Cursor).nextActionSortValue === "string" &&
      typeof (decoded as Cursor).updatedAt === "string" &&
      typeof (decoded as Cursor).engagementId === "string"
    ) {
      return decoded as Cursor;
    }
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
    : db`${value}::timestamptz`;
}

async function fetchPipelineColumn(
  db: GrowthQueryExecutor,
  stage: OpenPipelineStage,
  afterCursorValue: string | undefined,
): Promise<PipelineColumn> {
  const cursor = afterCursorValue ? decodePipelineCursor(afterCursorValue) : null;
  const cursorFragment = cursor
    ? (() => {
        const sortValue = sortValueFragment(db, cursor.nextActionSortValue);
        return db`and (
          coalesce(p.next_action_due_at, 'infinity') > ${sortValue}
          or (
            coalesce(p.next_action_due_at, 'infinity') = ${sortValue}
            and de.updated_at < ${cursor.updatedAt}::timestamptz
          )
          or (
            coalesce(p.next_action_due_at, 'infinity') = ${sortValue}
            and de.updated_at = ${cursor.updatedAt}::timestamptz
            and de.id > ${cursor.engagementId}
          )
        )`;
      })()
    : db``;

  const [rows, aggregateRows] = await Promise.all([
    db<
      (Omit<PipelineCardRow, "lastActivityAt" | "nextActionDueAt"> & {
        lastActivityAt: Date;
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
        (coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)) as "estimatedValuePence",
        de.updated_at as "lastActivityAt",
        p.next_action as "nextAction",
        p.next_action_due_at as "nextActionDueAt"
      from growth.delivery_engagements de
      inner join growth.prospects p on p.id = de.prospect_id
      inner join growth.businesses b on b.id = p.business_id
      left join growth.contacts c on c.id = p.primary_contact_id
      where de.stage = ${stage}
        ${cursorFragment}
      order by coalesce(p.next_action_due_at, 'infinity') asc, de.updated_at desc, de.id asc
      limit ${STAGE_PAGE_SIZE + 1}
    `,
    db<{ totalCount: number; valueTotalPence: number }[]>`
      select
        count(*)::int as "totalCount",
        coalesce(
          sum(coalesce(de.one_off_value_pence, 0) + coalesce(de.monthly_value_pence, 0)),
          0
        )::int as "valueTotalPence"
      from growth.delivery_engagements de
      where de.stage = ${stage}
    `,
  ]);

  const hasNextPage = rows.length > STAGE_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, STAGE_PAGE_SIZE) : rows;
  const shapedRows = page.map((row) => ({
    ...row,
    lastActivityAt: row.lastActivityAt.toISOString(),
    nextActionDueAt: row.nextActionDueAt ? row.nextActionDueAt.toISOString() : null,
  }));
  const last = shapedRows.at(-1);

  return {
    stage,
    rows: shapedRows,
    totalCount: aggregateRows[0]?.totalCount ?? 0,
    valueTotalPence: aggregateRows[0]?.valueTotalPence ?? 0,
    nextCursor: hasNextPage && last ? encodePipelineCursor(last) : null,
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
        fetchPipelineColumn(db, stage, query.after[stage]),
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
