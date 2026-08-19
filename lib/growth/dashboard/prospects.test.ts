import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  decodeProspectCursor,
  encodeProspectCursor,
  FIT_SCORE_BAND_VALUES,
  getProspectListResult,
  OUTREACH_STATE_VALUES,
  parseProspectListQuery,
  STATUS_FILTER_VALUES,
  SUPPRESSION_FILTER_VALUES,
  type ProspectListQuery,
} from "./prospects";

/**
 * A minimal simulation of postgres.js's lazy fragment composition (see
 * "Building queries" in the postgres package README): calling the tagged
 * template synchronously returns an unresolved, thenable fragment so nested
 * `db\`...\`` fragments can be flattened into the outer query before any
 * query actually executes.
 */
type RecordedQuery = { text: string; values: readonly unknown[] };
type FakeRoute = { match: RegExp; rows: readonly object[] };
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

    return Promise.resolve(route.rows).then(onfulfilled, onrejected);
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

function baseQuery(overrides: Partial<ProspectListQuery> = {}): ProspectListQuery {
  return {
    q: "",
    sector: "",
    location: "",
    fitScoreMin: "all",
    status: "all",
    outreach: "all",
    suppressed: "all",
    after: null,
    ...overrides,
  };
}

const sampleRow = {
  prospectId: "00000000-0000-0000-0000-000000000001",
  businessName: "Smith & Sons Plumbing Ltd",
  websiteUrl: "https://smithandsonsplumbing.co.uk",
  sector: "Plumbing",
  location: "Maidstone",
  fitScore: 91,
  opportunitySummary: "No website, slow enquiry handling",
  recommendedOffer: "Website + AI Enquiry Agent",
  status: "ready_for_email_review",
  potentialValuePence: 650_000,
  nextAction: "Review email",
  nextActionDueAt: null,
  outreachState: "not_started",
};

function routesFor(overrides: {
  rows?: readonly object[];
  count?: number;
  sectors?: readonly object[];
  locations?: readonly object[];
}): FakeRoute[] {
  return [
    { match: /select distinct b\.sector/, rows: overrides.sectors ?? [{ sector: "Plumbing" }] },
    { match: /select distinct b\.locality/, rows: overrides.locations ?? [{ locality: "Maidstone" }] },
    { match: /select count\(\*\)::int as count/, rows: [{ count: overrides.count ?? 1 }] },
    { match: /"prospectId"/, rows: overrides.rows ?? [sampleRow] },
  ];
}

test("parseProspectListQuery defaults every filter to unset and canonicalises invalid values", () => {
  const query = parseProspectListQuery({
    fitScoreMin: "not-a-band",
    status: "not-a-status",
    outreach: "not-a-state",
    suppressed: "not-a-state",
  });

  assert.deepEqual(query, {
    q: "",
    sector: "",
    location: "",
    fitScoreMin: "all",
    status: "all",
    outreach: "all",
    suppressed: "all",
    after: null,
  });
});

test("parseProspectListQuery takes the first value when a parameter is duplicated", () => {
  const query = parseProspectListQuery({
    q: ["first", "second"],
    sector: ["Plumbing", "Garage"],
  });

  assert.equal(query.q, "first");
  assert.equal(query.sector, "Plumbing");
});

test("parseProspectListQuery drops search text that exceeds the safe length", () => {
  const query = parseProspectListQuery({ q: "x".repeat(200) });
  assert.equal(query.q, "");
});

test("parseProspectListQuery only accepts known enum values", () => {
  for (const value of FIT_SCORE_BAND_VALUES) {
    assert.equal(parseProspectListQuery({ fitScoreMin: value }).fitScoreMin, value);
  }
  for (const value of STATUS_FILTER_VALUES) {
    assert.equal(parseProspectListQuery({ status: value }).status, value);
  }
  for (const value of OUTREACH_STATE_VALUES) {
    assert.equal(parseProspectListQuery({ outreach: value }).outreach, value);
  }
  for (const value of SUPPRESSION_FILTER_VALUES) {
    assert.equal(parseProspectListQuery({ suppressed: value }).suppressed, value);
  }
});

test("prospect cursors round-trip and reject malformed input", () => {
  const cursor = encodeProspectCursor(91, "00000000-0000-0000-0000-000000000001");
  assert.deepEqual(decodeProspectCursor(cursor), {
    fitScore: 91,
    prospectId: "00000000-0000-0000-0000-000000000001",
  });

  assert.equal(decodeProspectCursor("not-base64-!!"), null);
  assert.equal(decodeProspectCursor(Buffer.from("no-separator").toString("base64url")), null);
  assert.equal(
    decodeProspectCursor(Buffer.from("abc:").toString("base64url")),
    null,
  );
});

test("getProspectListResult applies the free-text search across business and contact names", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery({ q: "Smith" }), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /b\.legal_name ilike/);
  assert.ok(listQuery.values.includes("%Smith%"));
});

test("getProspectListResult filters by Kent town and service sector", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(
    baseQuery({ sector: "Plumbing", location: "Maidstone" }),
    db,
  );

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /b\.sector = \?/);
  assert.match(listQuery.text, /b\.locality = \?/);
  assert.ok(listQuery.values.includes("Plumbing"));
  assert.ok(listQuery.values.includes("Maidstone"));
});

test("getProspectListResult applies the fit-score band as a minimum threshold", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery({ fitScoreMin: "70" }), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /p\.fit_score >= \?/);
  assert.ok(listQuery.values.includes(70));
});

test("getProspectListResult filters by research/pipeline status", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery({ status: "needs_review" }), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /p\.status = \?/);
  assert.ok(listQuery.values.includes("needs_review"));
});

test("getProspectListResult filters by outreach sequence state", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery({ outreach: "paused" }), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /coalesce\(seq\.state, 'not_started'\) = \?/);
  assert.ok(listQuery.values.includes("paused"));
});

test("getProspectListResult filters by suppression state without leaking emails into the query text", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery({ suppressed: "suppressed" }), db);

  const suppressedQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(suppressedQuery);
  assert.match(suppressedQuery.text, /exists \(/);

  const { db: contactableDb, queries: contactableQueries } = createFakeGrowthDb(
    routesFor({}),
  );
  await getProspectListResult(baseQuery({ suppressed: "contactable" }), contactableDb);
  const contactableQuery = contactableQueries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(contactableQuery);
  assert.match(contactableQuery.text, /not exists \(/);
});

test("getProspectListResult sorts by fit score with a stable ID tiebreaker", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));

  await getProspectListResult(baseQuery(), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /order by p\.fit_score desc, p\.id asc/);
});

test("getProspectListResult paginates with a keyset cursor and reports whether another page exists", async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...sampleRow,
    prospectId: `prospect-${index}`,
    fitScore: 91 - index,
  }));

  const { db } = createFakeGrowthDb(routesFor({ rows, count: 128 }));

  const state = await getProspectListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.equal(state.data.rows.length, 20);
  assert.equal(state.data.totalCount, 128);
  assert.ok(state.data.nextCursor);

  const decoded = decodeProspectCursor(state.data.nextCursor as string);
  assert.deepEqual(decoded, { fitScore: 72, prospectId: "prospect-19" });
});

test("getProspectListResult applies the decoded cursor as a keyset predicate", async () => {
  const { db, queries } = createFakeGrowthDb(routesFor({}));
  const after = encodeProspectCursor(80, "prospect-19");

  await getProspectListResult(baseQuery({ after }), db);

  const listQuery = queries.find((q) => q.text.includes('"prospectId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /p\.fit_score < \?/);
  assert.match(listQuery.text, /p\.fit_score = \? and p\.id > \?/);
  assert.ok(listQuery.values.includes(80));
  assert.ok(listQuery.values.includes("prospect-19"));
});

test("getProspectListResult returns real, bounded filter facets", async () => {
  const { db } = createFakeGrowthDb(
    routesFor({
      sectors: [{ sector: "Garage" }, { sector: "Plumbing" }],
      locations: [{ locality: "Ashford" }, { locality: "Maidstone" }],
    }),
  );

  const state = await getProspectListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.deepEqual(state.data.facets.sectors, ["Garage", "Plumbing"]);
  assert.deepEqual(state.data.facets.locations, ["Ashford", "Maidstone"]);
});

test("getProspectListResult fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getProspectListResult(
    baseQuery(),
    db,
    () => "test-correlation-id",
  );

  assert.equal(state.status, "error");
  if (state.status !== "error") return;
  assert.equal(state.correlationId, "test-correlation-id");
  assert.doesNotMatch(state.message, /connection refused/);
});
