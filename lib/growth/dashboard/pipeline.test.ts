import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  decodePipelineCursor,
  encodePipelineCursor,
  getPipelineBoardResult,
  OPEN_PIPELINE_STAGES,
  parsePipelineBoardQuery,
  type PipelineCardRow,
  type PipelineBoardQuery,
} from "./pipeline";

/**
 * A minimal simulation of postgres.js's lazy fragment composition, extended
 * (relative to the copy in prospects.test.ts) so a route's rows can be a
 * function of the bound values: every stage query has identical SQL text
 * (only the bound `stage` value differs), so text-only matching can't tell
 * "new" apart from "qualified".
 */
type RecordedQuery = { text: string; values: readonly unknown[] };
type FakeRouteRows =
  | readonly object[]
  | ((values: readonly unknown[]) => readonly object[]);
type FakeRoute = { match: RegExp; rows: FakeRouteRows };
type FakeDbContext = { routes: readonly FakeRoute[]; queries: RecordedQuery[] };

class FakeRawFragment {
  constructor(public readonly text: string) {}
}

class FakeFragment {
  constructor(
    public readonly strings: readonly string[],
    public readonly values: readonly unknown[],
    private readonly context: FakeDbContext,
  ) {}

  then<T>(
    onfulfilled?: (value: unknown) => T,
    onrejected?: (reason: unknown) => T,
  ) {
    const { text, boundValues } = flatten(this.strings, this.values);
    this.context.queries.push({ text, values: boundValues });

    const route = this.context.routes.find(({ match }) => match.test(text));
    if (!route) {
      return Promise.reject(
        new Error(`No fake route matched query: ${text}`),
      ).then(onfulfilled, onrejected);
    }

    const rows =
      typeof route.rows === "function" ? route.rows(boundValues) : route.rows;
    return Promise.resolve(rows).then(onfulfilled, onrejected);
  }
}

function flatten(
  strings: readonly string[],
  values: readonly unknown[],
): { text: string; boundValues: unknown[] } {
  let text = strings[0] ?? "";
  const boundValues: unknown[] = [];

  for (const [index, value] of values.entries()) {
    if (value instanceof FakeFragment) {
      const nested = flatten(value.strings, value.values);
      text += nested.text;
      boundValues.push(...nested.boundValues);
    } else if (value instanceof FakeRawFragment) {
      text += value.text;
    } else {
      text += "?";
      boundValues.push(value);
    }

    text += strings[index + 1] ?? "";
  }

  return { text: text.replace(/\s+/g, " ").trim(), boundValues };
}

function createFakeGrowthDb(routes: readonly FakeRoute[]): {
  db: GrowthQueryExecutor;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  const context: FakeDbContext = { routes, queries };

  function tag(strings: TemplateStringsArray, ...values: readonly unknown[]) {
    return new FakeFragment(strings, values, context);
  }

  tag.unsafe = (text: string) => new FakeRawFragment(text);

  return { db: tag as unknown as GrowthQueryExecutor, queries };
}

function sampleRow(overrides: Partial<PipelineCardRow> = {}): PipelineCardRow {
  return {
    engagementId: "00000000-0000-0000-0000-000000000001",
    version: 1,
    prospectId: "00000000-0000-0000-0000-000000000002",
    businessName: "Smith & Sons Plumbing Ltd",
    primaryContactName: "Jamie Smith",
    offerFocus: "Website + AI Enquiry Agent",
    stage: "new",
    estimatedValuePence: 650_000,
    lastActivityAt: "2026-08-20T09:00:00.000Z",
    nextAction: "Review scope",
    nextActionDueAt: "2026-08-21T09:00:00.000Z",
    ...overrides,
  };
}

function sampleDbRow(overrides: Partial<PipelineCardRow> = {}): object {
  const row = sampleRow(overrides);
  return {
    ...row,
    lastActivityAt: new Date(row.lastActivityAt),
    nextActionDueAt: row.nextActionDueAt ? new Date(row.nextActionDueAt) : null,
  };
}

function emptyBoardRoutes(): FakeRoute[] {
  return [
    { match: /"engagementId"/, rows: [] },
    {
      match: /"totalCount"/,
      rows: [{ totalCount: 0, valueTotalPence: 0 }],
    },
  ];
}

function baseQuery(overrides: Partial<PipelineBoardQuery> = {}): PipelineBoardQuery {
  return { after: {}, ...overrides };
}

test("parsePipelineBoardQuery only reads known per-stage after_<stage> params", () => {
  const query = parsePipelineBoardQuery({
    after_new: "cursor-new",
    after_qualified: "cursor-qualified",
    after_won: "cursor-should-be-ignored",
    unrelated: "ignored",
  });

  assert.deepEqual(query, {
    after: { new: "cursor-new", qualified: "cursor-qualified" },
  });
});

test("parsePipelineBoardQuery drops empty or oversized cursor values", () => {
  const query = parsePipelineBoardQuery({
    after_new: "   ",
    after_qualified: "x".repeat(500),
  });

  assert.deepEqual(query, { after: {} });
});

test("pipeline cursors round-trip and reject malformed input", () => {
  const row = sampleRow({ nextActionDueAt: "2026-08-21T09:00:00.000Z" });
  const cursor = encodePipelineCursor(row);

  assert.deepEqual(decodePipelineCursor(cursor), {
    nextActionSortValue: "2026-08-21T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    engagementId: "00000000-0000-0000-0000-000000000001",
  });

  assert.equal(decodePipelineCursor("not-base64-!!"), null);
  assert.equal(
    decodePipelineCursor(Buffer.from("not json").toString("base64url")),
    null,
  );
});

test("a null next action due date encodes as the infinity sentinel", () => {
  const row = sampleRow({ nextActionDueAt: null });
  const cursor = decodePipelineCursor(encodePipelineCursor(row));
  assert.equal(cursor?.nextActionSortValue, "infinity");
});

test("getPipelineBoardResult queries only the open pipeline stages, never won or lost", async () => {
  const { db, queries } = createFakeGrowthDb(emptyBoardRoutes());

  await getPipelineBoardResult(baseQuery(), db);

  const stageBindings = queries
    .filter((query) => query.text.includes("de.stage = ?"))
    .map((query) => query.values[0]);

  assert.deepEqual(new Set(stageBindings), new Set(OPEN_PIPELINE_STAGES));
  assert.ok(!stageBindings.includes("won"));
  assert.ok(!stageBindings.includes("lost"));
});

test("getPipelineBoardResult reconciles each column's count and value total with its rows", async () => {
  const stageTotals: Record<string, { totalCount: number; valueTotalPence: number }> = {
    new: { totalCount: 5, valueTotalPence: 1_200_000 },
    qualified: { totalCount: 2, valueTotalPence: 400_000 },
    proposal: { totalCount: 0, valueTotalPence: 0 },
    negotiation: { totalCount: 1, valueTotalPence: 900_000 },
  };
  const stageRows: Record<string, object[]> = {
    new: [sampleDbRow({ stage: "new" }), sampleDbRow({ stage: "new", engagementId: "row-2" })],
    qualified: [sampleDbRow({ stage: "qualified" })],
    proposal: [],
    negotiation: [sampleDbRow({ stage: "negotiation" })],
  };

  const { db } = createFakeGrowthDb([
    {
      match: /"engagementId"/,
      rows: (values) => stageRows[values[0] as string] ?? [],
    },
    {
      match: /"totalCount"/,
      rows: (values) => [stageTotals[values[0] as string]],
    },
  ]);

  const state = await getPipelineBoardResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  for (const stage of OPEN_PIPELINE_STAGES) {
    const expected = stageTotals[stage];
    assert.equal(state.data.columns[stage].totalCount, expected?.totalCount);
    assert.equal(state.data.columns[stage].valueTotalPence, expected?.valueTotalPence);
  }
  assert.equal(state.data.columns.new.rows.length, 2);
  assert.equal(state.data.columns.proposal.rows.length, 0);
});

test("getPipelineBoardResult orders by next action due date, then last activity, then a stable ID tiebreaker", async () => {
  const { db, queries } = createFakeGrowthDb(emptyBoardRoutes());

  await getPipelineBoardResult(baseQuery(), db);

  const listQuery = queries.find((query) => query.text.includes('"engagementId"'));
  assert.ok(listQuery);
  assert.match(
    listQuery.text,
    /order by coalesce\(p\.next_action_due_at, 'infinity'\) asc, de\.updated_at desc, de\.id asc/,
  );
});

test("getPipelineBoardResult bounds each column to the page size and reports a next cursor", async () => {
  const rows = Array.from({ length: 21 }, (_, index) =>
    sampleDbRow({ stage: "new", engagementId: `row-${index}` }),
  );

  const { db } = createFakeGrowthDb([
    {
      match: /"engagementId"/,
      rows: (values) => (values[0] === "new" ? rows : []),
    },
    {
      match: /"totalCount"/,
      rows: () => [{ totalCount: 128, valueTotalPence: 5_000_000 }],
    },
  ]);

  const state = await getPipelineBoardResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.equal(state.data.columns.new.rows.length, 20);
  assert.equal(state.data.columns.new.totalCount, 128);
  assert.ok(state.data.columns.new.nextCursor);

  const decoded = decodePipelineCursor(state.data.columns.new.nextCursor as string);
  assert.equal(decoded?.engagementId, "row-19");

  for (const stage of ["qualified", "proposal", "negotiation"] as const) {
    assert.equal(state.data.columns[stage].nextCursor, null);
  }
});

test("getPipelineBoardResult applies the decoded per-stage cursor as a keyset predicate", async () => {
  const { db, queries } = createFakeGrowthDb(emptyBoardRoutes());
  const after = encodePipelineCursor(
    sampleRow({
      stage: "qualified",
      engagementId: "prospect-19",
      lastActivityAt: "2026-08-19T09:00:00.000Z",
      nextActionDueAt: "2026-08-20T09:00:00.000Z",
    }),
  );

  await getPipelineBoardResult(baseQuery({ after: { qualified: after } }), db);

  const listQueries = queries.filter((query) => query.text.includes('"engagementId"'));
  const qualifiedQuery = listQueries.find((query) =>
    query.values.includes("2026-08-20T09:00:00.000Z"),
  );
  assert.ok(qualifiedQuery);
  assert.match(qualifiedQuery.text, /coalesce\(p\.next_action_due_at, 'infinity'\) > \?::timestamptz/);
  assert.ok(qualifiedQuery.values.includes("prospect-19"));

  const newQuery = listQueries.find((query) => query.values[0] === "new");
  assert.ok(newQuery);
  assert.doesNotMatch(newQuery.text, /coalesce\(p\.next_action_due_at, 'infinity'\) > \?::timestamptz/);
});

test("getPipelineBoardResult fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getPipelineBoardResult(baseQuery(), db, () => "fixed-correlation-id");
  assert.deepEqual(state, {
    status: "error",
    message: "The pipeline board could not load.",
    correlationId: "fixed-correlation-id",
  });
});
