import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  decodeDealCursor,
  encodeDealCursor,
  getDealDetail,
  getDealListResult,
  parseDealListQuery,
  type DealListQuery,
  type DealListRow,
} from "./deals";

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

function baseQuery(overrides: Partial<DealListQuery> = {}): DealListQuery {
  return {
    stage: "all",
    valueBandMin: "all",
    owner: "",
    nextAction: "all",
    after: null,
    ...overrides,
  };
}

function sampleListDbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    engagementId: "00000000-0000-0000-0000-000000000001",
    version: 1,
    businessName: "Smith & Sons Plumbing Ltd",
    primaryContactName: "Jamie Smith",
    offerFocus: "Website + AI Enquiry Agent",
    stage: "proposal",
    valuePence: 650_000,
    nextAction: "Send proposal",
    nextActionDueAt: null,
    updatedAt: new Date("2026-08-20T09:00:00.000Z"),
    ...overrides,
  };
}

function listRoutes(overrides: {
  rows?: readonly object[];
  count?: number;
} = {}): FakeRoute[] {
  return [
    { match: /select count\(\*\)::int as count/, rows: [{ count: overrides.count ?? 1 }] },
    { match: /"engagementId"/, rows: overrides.rows ?? [sampleListDbRow()] },
  ];
}

test("parseDealListQuery defaults every filter to unset and canonicalises invalid values", () => {
  const query = parseDealListQuery({
    stage: "not-a-stage",
    valueBandMin: "not-a-band",
    owner: "not-an-email",
    nextAction: "not-a-filter",
  });

  assert.deepEqual(query, {
    stage: "all",
    valueBandMin: "all",
    owner: "",
    nextAction: "all",
    after: null,
  });
});

test("parseDealListQuery accepts a valid owner email", () => {
  const query = parseDealListQuery({ owner: "j.ntagengwa@faithfulsoftware.dev" });
  assert.equal(query.owner, "j.ntagengwa@faithfulsoftware.dev");
});

test("deal cursors round-trip and reject malformed input", () => {
  const row: DealListRow = {
    engagementId: "00000000-0000-0000-0000-000000000001",
    version: 1,
    businessName: "Smith & Sons Plumbing Ltd",
    primaryContactName: "Jamie Smith",
    offerFocus: "Website + AI Enquiry Agent",
    stage: "proposal",
    valuePence: 650_000,
    valueKind: "estimated",
    nextAction: null,
    nextActionDueAt: null,
    updatedAt: "2026-08-20T09:00:00.000Z",
  };
  const cursor = encodeDealCursor(row);
  assert.deepEqual(decodeDealCursor(cursor), {
    updatedAt: "2026-08-20T09:00:00.000Z",
    engagementId: "00000000-0000-0000-0000-000000000001",
  });
  assert.equal(decodeDealCursor("not-base64-!!"), null);
});

test("getDealListResult filters by stage", async () => {
  const { db, queries } = createFakeGrowthDb(listRoutes());
  await getDealListResult(baseQuery({ stage: "negotiation" }), db);

  const listQuery = queries.find((q) => q.text.includes('"engagementId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /de\.stage = \?/);
  assert.ok(listQuery.values.includes("negotiation"));
});

test("getDealListResult applies the value band as a minimum threshold", async () => {
  const { db, queries } = createFakeGrowthDb(listRoutes());
  await getDealListResult(baseQuery({ valueBandMin: "200000" }), db);

  const listQuery = queries.find((q) => q.text.includes('"engagementId"'));
  assert.ok(listQuery);
  assert.ok(listQuery.values.includes(200000));
});

test("getDealListResult filters overdue vs upcoming vs no next action", async () => {
  for (const filter of ["overdue", "upcoming", "none"] as const) {
    const { db, queries } = createFakeGrowthDb(listRoutes());
    await getDealListResult(baseQuery({ nextAction: filter }), db);
    const listQuery = queries.find((q) => q.text.includes('"engagementId"'));
    assert.ok(listQuery, `expected a query for filter ${filter}`);
  }
});

test("getDealListResult labels value as agreed once won and estimated otherwise", async () => {
  const { db } = createFakeGrowthDb(
    listRoutes({ rows: [sampleListDbRow({ stage: "won", engagementId: "won-1" })] }),
  );
  const state = await getDealListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.equal(state.data.rows[0]?.valueKind, "agreed");

  const { db: openDb } = createFakeGrowthDb(listRoutes());
  const openState = await getDealListResult(baseQuery(), openDb);
  assert.equal(openState.status, "ready");
  if (openState.status !== "ready") return;
  assert.equal(openState.data.rows[0]?.valueKind, "estimated");
});

test("getDealListResult paginates with a keyset cursor", async () => {
  const rows = Array.from({ length: 21 }, (_, index) =>
    sampleListDbRow({
      engagementId: `deal-${index}`,
      updatedAt: new Date(2026, 7, 20 - index),
    }),
  );
  const { db } = createFakeGrowthDb(listRoutes({ rows, count: 128 }));

  const state = await getDealListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.equal(state.data.rows.length, 20);
  assert.equal(state.data.totalCount, 128);
  assert.ok(state.data.nextCursor);
});

test("getDealListResult fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getDealListResult(baseQuery(), db, () => "fixed-correlation-id");
  assert.deepEqual(state, {
    status: "error",
    message: "The deal list could not load.",
    correlationId: "fixed-correlation-id",
  });
});

const ENGAGEMENT_ID = "11111111-1111-4111-8111-111111111111";

function sampleCoreRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    engagementId: ENGAGEMENT_ID,
    version: 3,
    prospectId: "22222222-2222-4222-8222-222222222222",
    prospectVersion: 5,
    stage: "negotiation",
    offerFocus: "Website + AI Enquiry Agent",
    oneOffValuePence: 500_000,
    monthlyValuePence: null,
    probabilityPercent: 60,
    expectedCloseDate: null,
    wonAt: null,
    lostAt: null,
    lossReason: null,
    deliveryStatus: "not_started",
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-20T09:00:00.000Z"),
    businessLegalName: "Smith & Sons Plumbing Ltd",
    businessTradingName: null,
    businessSector: "Plumbing",
    businessLocality: "Maidstone",
    businessWebsiteUrl: null,
    contactFirstName: "Jamie",
    contactLastName: "Smith",
    contactRoleTitle: "Director",
    contactEmail: "jamie@smithandsons.example.test",
    opportunitySummary: "No website, slow enquiry handling",
    proposedScope: "Website + AI Enquiry Agent",
    nextAction: "Send proposal",
    nextActionDueAt: null,
    sequenceId: null,
    sequenceStatus: null,
    sequenceLastActivityAt: null,
    ...overrides,
  };
}

function detailRoutes(overrides: {
  core?: readonly object[];
  evidence?: readonly object[];
  history?: readonly object[];
} = {}): FakeRoute[] {
  return [
    { match: /"engagementId"/, rows: overrides.core ?? [sampleCoreRow()] },
    { match: /from growth\.source_evidence/, rows: overrides.evidence ?? [] },
    { match: /from growth\.commercial_stage_events/, rows: overrides.history ?? [] },
  ];
}

test("getDealDetail returns not_found for an unknown engagement", async () => {
  const { db } = createFakeGrowthDb(detailRoutes({ core: [] }));
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.deepEqual(state, { status: "not_found" });
});

test("getDealDetail rejects a malformed engagement ID without querying", async () => {
  const db = (() => {
    throw new Error("must not be called");
  }) as unknown as GrowthQueryExecutor;
  const state = await getDealDetail("not-a-uuid", db);
  assert.deepEqual(state, { status: "not_found" });
});

test("getDealDetail shows an open deal with an estimated value", async () => {
  const { db } = createFakeGrowthDb(detailRoutes());
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.equal(state.status, "found");
  if (state.status !== "found") return;
  assert.equal(state.data.stage, "negotiation");
  assert.equal(state.data.valueKind, "estimated");
  assert.equal(state.data.lossReason, null);
});

test("getDealDetail shows a won deal with an agreed value", async () => {
  const { db } = createFakeGrowthDb(
    detailRoutes({
      core: [sampleCoreRow({ stage: "won", wonAt: new Date("2026-08-21T09:00:00.000Z") })],
    }),
  );
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.equal(state.status, "found");
  if (state.status !== "found") return;
  assert.equal(state.data.valueKind, "agreed");
  assert.equal(state.data.wonAt, "2026-08-21T09:00:00.000Z");
});

test("getDealDetail shows a lost deal with its loss reason", async () => {
  const { db } = createFakeGrowthDb(
    detailRoutes({
      core: [
        sampleCoreRow({
          stage: "lost",
          lostAt: new Date("2026-08-21T09:00:00.000Z"),
          lossReason: "budget",
        }),
      ],
    }),
  );
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.equal(state.status, "found");
  if (state.status !== "found") return;
  assert.equal(state.data.lossReason, "budget");
});

test("getDealDetail orders commercial history newest first", async () => {
  const historyRows = [
    {
      id: "event-2",
      fromState: "proposal",
      toState: "negotiation",
      reasonCode: null,
      occurredAt: new Date("2026-08-15T09:00:00.000Z"),
    },
    {
      id: "event-1",
      fromState: "new",
      toState: "qualified",
      reasonCode: null,
      occurredAt: new Date("2026-08-10T09:00:00.000Z"),
    },
  ];
  const { db, queries } = createFakeGrowthDb(detailRoutes({ history: historyRows }));
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.equal(state.status, "found");
  if (state.status !== "found") return;
  assert.deepEqual(
    state.data.commercialHistory.map((entry) => entry.id),
    ["event-2", "event-1"],
  );

  const historyQuery = queries.find((q) => q.text.includes("commercial_stage_events"));
  assert.ok(historyQuery);
  assert.match(historyQuery.text, /dimension = 'commercial'/);
  assert.match(historyQuery.text, /order by occurred_at desc/);
});

test("getDealDetail never selects reply bodies or provider tokens", async () => {
  const { db, queries } = createFakeGrowthDb(detailRoutes());
  await getDealDetail(ENGAGEMENT_ID, db);

  for (const query of queries) {
    assert.doesNotMatch(query.text, /html_snapshot/);
    assert.doesNotMatch(query.text, /text_snapshot/);
    assert.doesNotMatch(query.text, /encrypted_refresh_token/);
    assert.doesNotMatch(query.text, /access_token/);
  }
});

test("getDealDetail resolves correspondence to metadata only, with no message body columns", async () => {
  const { db } = createFakeGrowthDb(
    detailRoutes({
      core: [
        sampleCoreRow({
          sequenceId: "33333333-3333-4333-8333-333333333333",
          sequenceStatus: "active",
          sequenceLastActivityAt: new Date("2026-08-19T09:00:00.000Z"),
        }),
      ],
    }),
  );
  const state = await getDealDetail(ENGAGEMENT_ID, db);
  assert.equal(state.status, "found");
  if (state.status !== "found") return;
  assert.deepEqual(state.data.correspondence, {
    sequenceId: "33333333-3333-4333-8333-333333333333",
    status: "active",
    lastActivityAt: "2026-08-19T09:00:00.000Z",
  });
});

test("two engagements for the same business are both visible independently", async () => {
  const rows = [
    sampleListDbRow({ engagementId: "deal-a", businessName: "Acme Ltd", stage: "lost" }),
    sampleListDbRow({ engagementId: "deal-b", businessName: "Acme Ltd", stage: "qualified" }),
  ];
  const { db } = createFakeGrowthDb(listRoutes({ rows, count: 2 }));
  const state = await getDealListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.equal(state.data.rows.length, 2);
  assert.deepEqual(
    state.data.rows.map((row) => row.engagementId).sort(),
    ["deal-a", "deal-b"],
  );
});

test("getDealDetail fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getDealDetail(ENGAGEMENT_ID, db, () => "fixed-correlation-id");
  assert.deepEqual(state, {
    status: "error",
    message: "The deal record could not load.",
    correlationId: "fixed-correlation-id",
  });
});
