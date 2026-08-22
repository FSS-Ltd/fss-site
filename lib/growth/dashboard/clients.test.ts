import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  decodeClientCursor,
  encodeClientCursor,
  getClientDetail,
  getClientListResult,
  getClientThankYouReview,
  parseClientListQuery,
  type ClientListQuery,
  type ClientListRow,
} from "./clients";

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

function baseQuery(overrides: Partial<ClientListQuery> = {}): ClientListQuery {
  return { status: "all", after: null, ...overrides };
}

function sampleListDbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    businessId: "00000000-0000-0000-0000-000000000001",
    businessName: "Smith & Sons Plumbing Ltd",
    sector: "Trades",
    locality: "Maidstone",
    primaryContactName: "Jamie Smith",
    engagementCount: 1,
    lifetimeValuePence: 500_000,
    lastActivityAt: new Date("2026-08-20T09:00:00.000Z"),
    latestDeliveryStatus: "discovery",
    nextAction: "Kick off discovery",
    nextActionDueAt: null,
    ...overrides,
  };
}

function listRoutes(overrides: { rows?: readonly object[]; count?: number } = {}): FakeRoute[] {
  return [
    { match: /select count\(\*\)::int as count/, rows: [{ count: overrides.count ?? 1 }] },
    { match: /"businessId"/, rows: overrides.rows ?? [sampleListDbRow()] },
  ];
}

test("parseClientListQuery defaults to all and canonicalises invalid values", () => {
  assert.deepEqual(parseClientListQuery({ status: "not-a-status" }), {
    status: "all",
    after: null,
  });
});

test("client cursors round-trip and reject malformed input", () => {
  const row: ClientListRow = {
    businessId: "00000000-0000-0000-0000-000000000001",
    businessName: "Smith & Sons Plumbing Ltd",
    sector: "Trades",
    locality: "Maidstone",
    primaryContactName: "Jamie Smith",
    engagementCount: 1,
    latestDeliveryStatus: "discovery",
    lifetimeValuePence: 500_000,
    lastActivityAt: "2026-08-20T09:00:00.000Z",
    nextAction: null,
    nextActionDueAt: null,
  };
  const cursor = encodeClientCursor(row);
  assert.deepEqual(decodeClientCursor(cursor), {
    lastActivityAt: "2026-08-20T09:00:00.000Z",
    businessId: "00000000-0000-0000-0000-000000000001",
  });
  assert.equal(decodeClientCursor("not-base64-!!"), null);
});

test("getClientListResult filters by active status", async () => {
  const { db, queries } = createFakeGrowthDb(listRoutes());
  await getClientListResult(baseQuery({ status: "active" }), db);

  const listQuery = queries.find((q) => q.text.includes('"businessId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /agg\.has_active/);
});

test("getClientListResult filters by completed status", async () => {
  const { db, queries } = createFakeGrowthDb(listRoutes());
  await getClientListResult(baseQuery({ status: "completed" }), db);

  const listQuery = queries.find((q) => q.text.includes('"businessId"'));
  assert.ok(listQuery);
  assert.match(listQuery.text, /not agg\.has_active/);
});

test("getClientListResult returns rows with a lifetime value and latest delivery status", async () => {
  const { db } = createFakeGrowthDb(listRoutes());
  const state = await getClientListResult(baseQuery(), db);

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;
  assert.equal(state.data.rows[0]?.lifetimeValuePence, 500_000);
  assert.equal(state.data.rows[0]?.latestDeliveryStatus, "discovery");
});

test("getClientListResult paginates with a keyset cursor", async () => {
  const rows = Array.from({ length: 21 }, (_, index) =>
    sampleListDbRow({
      businessId: `business-${index}`,
      lastActivityAt: new Date(2026, 7, 20 - index),
    }),
  );
  const { db } = createFakeGrowthDb(listRoutes({ rows, count: 40 }));

  const state = await getClientListResult(baseQuery(), db);
  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.equal(state.data.rows.length, 20);
  assert.equal(state.data.totalCount, 40);
  assert.ok(state.data.nextCursor);
});

test("getClientListResult fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getClientListResult(baseQuery(), db, () => "fixed-correlation-id");
  assert.deepEqual(state, {
    status: "error",
    message: "The client list could not load.",
    correlationId: "fixed-correlation-id",
  });
});

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const ENGAGEMENT_ID = "22222222-2222-4222-8222-222222222222";

function sampleBusinessRow() {
  return {
    legalName: "Smith & Sons Plumbing Ltd",
    tradingName: null,
    sector: "Trades",
    locality: "Maidstone",
    websiteUrl: "https://smithplumbing.example",
  };
}

function sampleEngagementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    engagementId: ENGAGEMENT_ID,
    version: 4,
    name: "Website + AI Enquiry Agent",
    deliveryStatus: "discovery",
    oneOffValuePence: 500_000,
    monthlyValuePence: 15_000,
    wonAt: new Date("2026-08-10T09:00:00.000Z"),
    deliveryStartDate: new Date("2026-08-12T00:00:00.000Z"),
    deliveryTargetDate: null,
    newsletterInvitedAt: null,
    contactFirstName: "Jamie",
    contactLastName: "Smith",
    contactRoleTitle: "Owner",
    contactEmail: "jamie@smithplumbing.example",
    messageId: null,
    messageStatus: null,
    ...overrides,
  };
}

function detailRoutes(overrides: {
  business?: object | null;
  engagements?: readonly object[];
  history?: readonly object[];
} = {}): FakeRoute[] {
  return [
    {
      match: /"legalName"/,
      rows: overrides.business === undefined ? [sampleBusinessRow()] : overrides.business ? [overrides.business] : [],
    },
    { match: /"fromState"/, rows: overrides.history ?? [] },
    { match: /"engagementId"/, rows: overrides.engagements ?? [sampleEngagementRow()] },
  ];
}

test("getClientDetail returns the business with each won engagement", async () => {
  const { db } = createFakeGrowthDb(detailRoutes());
  const result = await getClientDetail(BUSINESS_ID, db);

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.data.business.legalName, "Smith & Sons Plumbing Ltd");
  assert.equal(result.data.engagements.length, 1);
  assert.equal(result.data.engagements[0]?.contact?.email, "jamie@smithplumbing.example");
});

test("getClientDetail shows every opportunity independently for a business with two won engagements", async () => {
  const { db } = createFakeGrowthDb(
    detailRoutes({
      engagements: [
        sampleEngagementRow({ engagementId: "engagement-1", deliveryStatus: "complete" }),
        sampleEngagementRow({ engagementId: "engagement-2", deliveryStatus: "discovery" }),
      ],
    }),
  );
  const result = await getClientDetail(BUSINESS_ID, db);

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.equal(result.data.engagements.length, 2);
});

test("getClientDetail links a pending thank-you message when one exists", async () => {
  const { db } = createFakeGrowthDb(
    detailRoutes({
      engagements: [
        sampleEngagementRow({
          deliveryStatus: "complete",
          messageId: "33333333-3333-4333-8333-333333333333",
          messageStatus: "pending_approval",
        }),
      ],
    }),
  );
  const result = await getClientDetail(BUSINESS_ID, db);

  assert.equal(result.status, "found");
  if (result.status !== "found") return;
  assert.deepEqual(result.data.engagements[0]?.thankYouMessage, {
    messageId: "33333333-3333-4333-8333-333333333333",
    status: "pending_approval",
  });
});

test("getClientDetail returns not_found for an unknown business", async () => {
  const { db } = createFakeGrowthDb(detailRoutes({ business: null }));
  const result = await getClientDetail(BUSINESS_ID, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getClientDetail returns not_found for a business with no won engagement", async () => {
  const { db } = createFakeGrowthDb(detailRoutes({ engagements: [] }));
  const result = await getClientDetail(BUSINESS_ID, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getClientDetail rejects a malformed business id without querying", async () => {
  const db = (() => {
    throw new Error("must not be called");
  }) as unknown as GrowthQueryExecutor;
  const result = await getClientDetail("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getClientDetail fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getClientDetail(BUSINESS_ID, db, () => "fixed-correlation-id");
  assert.deepEqual(result, {
    status: "error",
    message: "The client record could not load.",
    correlationId: "fixed-correlation-id",
  });
});

const MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

function sampleReviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    messageId: MESSAGE_ID,
    engagementId: ENGAGEMENT_ID,
    businessId: BUSINESS_ID,
    businessName: "Smith & Sons Plumbing Ltd",
    engagementName: "Website + AI Enquiry Agent",
    version: 1,
    status: "pending_approval",
    includedNewsletterInvite: true,
    subjectSnapshot: "Thank you for trusting FSS with Website + AI Enquiry Agent",
    htmlSnapshot: "<html><body>Hi Jamie</body></html>",
    textSnapshot: "Hi Jamie",
    testSentAt: null,
    contactFirstName: "Jamie",
    contactLastName: "Smith",
    contactEmail: "jamie@smithplumbing.example",
    ...overrides,
  };
}

test("getClientThankYouReview returns the stored snapshot for preview", async () => {
  const { db } = createFakeGrowthDb([
    { match: /"subjectSnapshot"/, rows: [sampleReviewRow()] },
  ]);

  const result = await getClientThankYouReview(MESSAGE_ID, "founder@faithfulsoftware.dev", db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.previewHtml, "<html><body>Hi Jamie</body></html>");
  assert.equal(result.data.recipientEmail, "jamie@smithplumbing.example");
  assert.equal(result.data.includedNewsletterInvite, true);
});

test("getClientThankYouReview reports unavailable for an unknown message", async () => {
  const { db } = createFakeGrowthDb([{ match: /"subjectSnapshot"/, rows: [] }]);

  const result = await getClientThankYouReview(MESSAGE_ID, "founder@faithfulsoftware.dev", db);
  assert.equal(result.status, "unavailable");
});

test("getClientThankYouReview rejects a malformed message id without querying", async () => {
  const db = (() => {
    throw new Error("must not be called");
  }) as unknown as GrowthQueryExecutor;
  const result = await getClientThankYouReview(
    "not-a-uuid",
    "founder@faithfulsoftware.dev",
    db,
  );
  assert.equal(result.status, "unavailable");
});

test("getClientThankYouReview fails safe with a correlation ID when a query throws", async () => {
  const db = (() => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getClientThankYouReview(
    MESSAGE_ID,
    "founder@faithfulsoftware.dev",
    db,
    () => "fixed-correlation-id",
  );
  assert.deepEqual(result, {
    status: "error",
    message: "The client message could not load.",
    correlationId: "fixed-correlation-id",
  });
});
