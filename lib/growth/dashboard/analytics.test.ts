import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  getAnalyticsResult,
  parseAnalyticsQuery,
  shiftAnalyticsMonth,
  type AnalyticsQuery,
} from "./analytics";

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

function sampleFunnelRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    researchedProspects: 12,
    approvedFirstEmails: 10,
    replies: 4,
    qualifiedOpportunities: 3,
    proposals: 2,
    wins: 1,
    ...overrides,
  };
}

function sampleValuesRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    openPipelineValuePence: 900_000,
    agreedWonValuePence: 500_000,
    completedDeliveryValuePence: 300_000,
    ...overrides,
  };
}

function routes(overrides: {
  funnel?: readonly object[];
  values?: readonly object[];
  meetings?: readonly object[];
} = {}): FakeRoute[] {
  return [
    { match: /"researchedProspects"/, rows: overrides.funnel ?? [sampleFunnelRow()] },
    { match: /"openPipelineValuePence"/, rows: overrides.values ?? [sampleValuesRow()] },
    {
      match: /count\(distinct entity_id\)/,
      rows: overrides.meetings ?? [{ count: 3 }],
    },
  ];
}

test("parseAnalyticsQuery defaults to the current London month for an invalid or missing month", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  assert.deepEqual(parseAnalyticsQuery({}, now), { month: "2026-08" });
  assert.deepEqual(parseAnalyticsQuery({ month: "not-a-month" }, now), { month: "2026-08" });
});

test("parseAnalyticsQuery accepts a valid month key", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  assert.deepEqual(parseAnalyticsQuery({ month: "2026-03" }, now), { month: "2026-03" });
});

test("shiftAnalyticsMonth moves forward and backward within a year", () => {
  assert.equal(shiftAnalyticsMonth("2026-08", 1), "2026-09");
  assert.equal(shiftAnalyticsMonth("2026-08", -1), "2026-07");
});

test("shiftAnalyticsMonth rolls over a year boundary in both directions", () => {
  assert.equal(shiftAnalyticsMonth("2026-12", 1), "2027-01");
  assert.equal(shiftAnalyticsMonth("2026-01", -1), "2025-12");
});

function baseQuery(overrides: Partial<AnalyticsQuery> = {}): AnalyticsQuery {
  return { month: "2026-08", ...overrides };
}

test("getAnalyticsResult filters the open-pipeline value using the pipeline's own open stages", async () => {
  const { db, queries } = createFakeGrowthDb(routes());
  await getAnalyticsResult(baseQuery(), db);

  const valuesQuery = queries.find((q) => q.text.includes('"openPipelineValuePence"'));
  assert.ok(valuesQuery);
  assert.match(
    valuesQuery.text,
    /de\.stage in \('new', 'qualified', 'proposal', 'negotiation'\)/,
  );
});

test("getAnalyticsResult binds the resolved UTC window to every windowed query", async () => {
  const { db, queries } = createFakeGrowthDb(routes());
  await getAnalyticsResult(baseQuery({ month: "2026-08" }), db);

  const funnelQuery = queries.find((q) => q.text.includes('"researchedProspects"'));
  assert.ok(funnelQuery);
  const startUtc = funnelQuery.values.find(
    (value) => value instanceof Date && value.toISOString() === "2026-07-31T23:00:00.000Z",
  );
  const endUtc = funnelQuery.values.find(
    (value) => value instanceof Date && value.toISOString() === "2026-08-31T23:00:00.000Z",
  );
  assert.ok(startUtc, "expected the London-August start bound in UTC");
  assert.ok(endUtc, "expected the London-September start bound in UTC");
});

test("getAnalyticsResult composes the funnel, values, and rates for a normal month", async () => {
  const { db } = createFakeGrowthDb(routes());
  const state = await getAnalyticsResult(baseQuery(), db);

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.deepEqual(state.data.funnel, sampleFunnelRow());
  assert.deepEqual(state.data.values, sampleValuesRow());
  assert.equal(state.data.rates.meetingsCount, 3);
  assert.equal(state.data.rates.replyRate, 4 / 10);
  assert.equal(state.data.rates.meetingRate, 3 / 4);
  assert.equal(state.data.rates.proposalRate, 2 / 3);
  assert.equal(state.data.rates.winRate, 1 / 2);
  assert.deepEqual(state.data.range, { startDate: "2026-08-01", endDate: "2026-08-31" });
});

test("getAnalyticsResult reports null rates, not zero, for a window with no activity", async () => {
  const { db } = createFakeGrowthDb(
    routes({
      funnel: [
        sampleFunnelRow({
          researchedProspects: 0,
          approvedFirstEmails: 0,
          replies: 0,
          qualifiedOpportunities: 0,
          proposals: 0,
          wins: 0,
        }),
      ],
      values: [
        sampleValuesRow({
          openPipelineValuePence: 0,
          agreedWonValuePence: 0,
          completedDeliveryValuePence: 0,
        }),
      ],
      meetings: [{ count: 0 }],
    }),
  );
  const state = await getAnalyticsResult(baseQuery(), db);

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.equal(state.data.rates.replyRate, null);
  assert.equal(state.data.rates.meetingRate, null);
  assert.equal(state.data.rates.proposalRate, null);
  assert.equal(state.data.rates.winRate, null);
});

test("getAnalyticsResult fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getAnalyticsResult(baseQuery(), db, () => "fixed-correlation-id");
  assert.deepEqual(state, {
    status: "error",
    message: "The analytics for this month could not load.",
    correlationId: "fixed-correlation-id",
  });
});

test("getAnalyticsResult fails safe for a malformed month key rather than throwing", async () => {
  const db = (() => {
    throw new Error("must not be called");
  }) as unknown as GrowthQueryExecutor;

  const state = await getAnalyticsResult(
    { month: "not-a-month" },
    db,
    () => "fixed-correlation-id",
  );
  assert.equal(state.status, "error");
});
