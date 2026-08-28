import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  buildPipelineOverview,
  buildSequenceHealth,
  getOverviewViewModel,
  nextResearchRunAt,
  selectDefaultWorkQueueTab,
  type WorkQueueTab,
} from "./overview";

type RecordedQuery = { text: string; values: readonly unknown[] };

type FakeRoute = {
  match: RegExp;
  rows: readonly object[] | ((query: string) => readonly object[]);
};

function createFakeGrowthDb(routes: readonly FakeRoute[]): {
  db: GrowthQueryExecutor;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];

  const query = async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });

    const route = routes.find(({ match }) => match.test(text));
    if (!route) {
      throw new Error(`No fake route matched query: ${text}`);
    }

    return typeof route.rows === "function" ? route.rows(text) : route.rows;
  };

  return { db: query as unknown as GrowthQueryExecutor, queries };
}

test("buildPipelineOverview groups statuses into the four pipeline stages", () => {
  const overview = buildPipelineOverview([
    { status: "new", count: 4, valuePence: 100_000 },
    { status: "ready_for_email_review", count: 3, valuePence: 50_000 },
    { status: "qualified", count: 5, valuePence: 200_000 },
    { status: "proposal", count: 2, valuePence: 80_000 },
    { status: "negotiation", count: 1, valuePence: 40_000 },
  ]);

  assert.deepEqual(
    overview.stages.map(({ id, count, valuePence }) => ({ id, count, valuePence })),
    [
      { id: "new", count: 7, valuePence: 150_000 },
      { id: "qualified", count: 5, valuePence: 200_000 },
      { id: "proposal", count: 2, valuePence: 80_000 },
      { id: "negotiation", count: 1, valuePence: 40_000 },
    ],
  );
  assert.equal(overview.totalValuePence, 470_000);
});

test("buildPipelineOverview handles no open prospects", () => {
  const overview = buildPipelineOverview([]);

  assert.equal(overview.totalValuePence, 0);
  assert.ok(overview.stages.every((stage) => stage.count === 0));
});

test("selectDefaultWorkQueueTab prioritises an overdue follow-up", () => {
  const tabs: readonly WorkQueueTab[] = [
    { kind: "first_emails", totalCount: 4, rows: [] },
    { kind: "replies", totalCount: 2, rows: [] },
    {
      kind: "follow_ups",
      totalCount: 1,
      rows: [
        {
          prospectId: "p1",
          businessName: "Overdue Ltd",
          websiteUrl: null,
          fitScore: 80,
          offerFocus: "Website",
          status: "contacted",
          statusAt: "2020-01-01T00:00:00.000Z",
          evidenceCount: 1,
          potentialValuePence: 100_000,
          reviewHref: "/growth/outreach/sequences/s1",
          overdue: true,
        },
      ],
    },
  ];

  assert.equal(selectDefaultWorkQueueTab(tabs), "follow_ups");
});

test("selectDefaultWorkQueueTab otherwise prefers first emails, then replies", () => {
  const emptyRows: WorkQueueTab["rows"] = [];

  assert.equal(
    selectDefaultWorkQueueTab([
      { kind: "first_emails", totalCount: 3, rows: emptyRows },
      { kind: "replies", totalCount: 1, rows: emptyRows },
      { kind: "follow_ups", totalCount: 2, rows: emptyRows },
    ]),
    "first_emails",
  );

  assert.equal(
    selectDefaultWorkQueueTab([
      { kind: "first_emails", totalCount: 0, rows: emptyRows },
      { kind: "replies", totalCount: 1, rows: emptyRows },
      { kind: "follow_ups", totalCount: 2, rows: emptyRows },
    ]),
    "replies",
  );

  assert.equal(
    selectDefaultWorkQueueTab([
      { kind: "first_emails", totalCount: 0, rows: emptyRows },
      { kind: "replies", totalCount: 0, rows: emptyRows },
      { kind: "follow_ups", totalCount: 2, rows: emptyRows },
    ]),
    "follow_ups",
  );

  assert.equal(
    selectDefaultWorkQueueTab([
      { kind: "first_emails", totalCount: 0, rows: emptyRows },
      { kind: "replies", totalCount: 0, rows: emptyRows },
      { kind: "follow_ups", totalCount: 0, rows: emptyRows },
    ]),
    "first_emails",
  );
});

test("nextResearchRunAt is London-time aware across summer and winter offsets", () => {
  assert.equal(
    nextResearchRunAt("2026-08-16", new Date("2026-08-16T23:00:00.000Z")),
    "2026-08-17T05:00:00.000Z",
  );

  assert.equal(
    nextResearchRunAt("2026-01-16", new Date("2026-01-16T23:00:00.000Z")),
    "2026-01-17T06:00:00.000Z",
  );
});

test("nextResearchRunAt rolls forward when the computed run has already passed", () => {
  assert.equal(
    nextResearchRunAt("2026-08-16", new Date("2026-08-17T10:00:00.000Z")),
    "2026-08-18T05:00:00.000Z",
  );
});

test("nextResearchRunAt is null when no research run has ever completed", () => {
  assert.equal(nextResearchRunAt(null, new Date("2026-08-16T23:00:00.000Z")), null);
});

test("buildSequenceHealth guards against dividing by zero", () => {
  assert.deepEqual(
    buildSequenceHealth({
      sentCount: 0,
      failedCount: 0,
      sentEnrollmentCount: 0,
      repliedEnrollmentCount: 0,
    }),
    {
      sentCount: 0,
      failedCount: 0,
      deliveryRate: null,
      repliedEnrollmentCount: 0,
      sentEnrollmentCount: 0,
      replyRate: null,
    },
  );

  const withData = buildSequenceHealth({
    sentCount: 49,
    failedCount: 1,
    sentEnrollmentCount: 50,
    repliedEnrollmentCount: 8,
  });

  assert.equal(withData.deliveryRate, 0.98);
  assert.equal(withData.replyRate, 0.16);
});

const firstEmailRow = {
  prospectId: "00000000-0000-0000-0000-000000000001",
  businessName: "Smith & Sons Plumbing Ltd",
  websiteUrl: "https://smithandsonsplumbing.co.uk",
  fitScore: 91,
  offerFocus: "Website + AI Enquiry Agent",
  status: "ready_for_email_review",
  statusAt: new Date("2026-08-15T09:00:00.000Z"),
  potentialValuePence: 650_000,
  evidenceCount: 7,
  messageId: "00000000-0000-0000-0000-0000000000m1",
  totalCount: 2,
};

const replyRow = {
  prospectId: "00000000-0000-0000-0000-000000000002",
  businessName: "First Fix Electrical",
  websiteUrl: null,
  fitScore: 76,
  offerFocus: "Booking website",
  status: "replied",
  statusAt: new Date("2026-08-15T08:00:00.000Z"),
  potentialValuePence: 300_000,
  evidenceCount: 3,
  sequenceEnrollmentId: "00000000-0000-0000-0000-0000000000s1",
  totalCount: 1,
};

function buildFollowUpRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    prospectId: "00000000-0000-0000-0000-000000000003",
    businessName: "Greenfield Ltd",
    websiteUrl: null,
    fitScore: 68,
    offerFocus: "Website refresh",
    status: "contacted",
    statusAt: new Date("2020-01-01T00:00:00.000Z"),
    potentialValuePence: 200_000,
    evidenceCount: 2,
    sequenceEnrollmentId: "00000000-0000-0000-0000-0000000000s2",
    totalCount: 1,
    ...overrides,
  };
}

function baseRoutes(overrides: Partial<Record<string, readonly object[]>> = {}) {
  return [
    { match: /"emailsWaitingForApproval"/, rows: overrides.summary ?? [
      { emailsWaitingForApproval: 2, repliesNeedingAttention: 1 },
    ] },
    { match: /as count from growth\.email_messages/, rows: overrides.followUpsDueToday ?? [
      { count: 3 },
    ] },
    { match: /"lastRunDate"/, rows: overrides.lastRunDate ?? [{ lastRunDate: "2026-08-16" }] },
    { match: /"messageId"/, rows: overrides.firstEmails ?? [firstEmailRow] },
    { match: /p\.status = 'replied'/, rows: overrides.replies ?? [replyRow] },
    { match: /em\.step_number > 0/, rows: overrides.followUps ?? [buildFollowUpRow()] },
    { match: /group by p\.status/, rows: overrides.pipeline ?? [
      { status: "new", count: 7, valuePence: 420_000 },
      { status: "qualified", count: 5, valuePence: 680_000 },
    ] },
    { match: /"actionLabel"/, rows: overrides.upcomingActions ?? [
      {
        prospectId: "00000000-0000-0000-0000-000000000004",
        businessName: "BuildRight",
        actionLabel: "Send case study",
        status: "started_talks",
        dueAt: new Date("2026-08-17T09:00:00.000Z"),
      },
    ] },
    { match: /"sentCount"/, rows: overrides.delivery ?? [{ sentCount: 49, failedCount: 1 }] },
    { match: /"sentEnrollmentCount"/, rows: overrides.enrollments ?? [
      { sentEnrollmentCount: 50, repliedEnrollmentCount: 8 },
    ] },
  ];
}

test("getOverviewViewModel returns a ready state with reconciled counts", async () => {
  const { db, queries } = createFakeGrowthDb(baseRoutes());

  const state = await getOverviewViewModel(
    db,
    () => new Date("2026-08-16T08:00:00.000Z"),
    () => "unused-correlation-id",
  );

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  assert.equal(state.data.summary.emailsWaitingForApproval, 2);
  assert.equal(state.data.summary.repliesNeedingAttention, 1);
  assert.equal(state.data.summary.followUpsDueToday, 3);
  assert.equal(state.data.summary.nextResearchRunAt, "2026-08-17T05:00:00.000Z");

  const firstEmails = state.data.workQueue.find((tab) => tab.kind === "first_emails");
  assert.equal(firstEmails?.totalCount, 2);
  assert.equal(firstEmails?.rows.length, 1);
  assert.equal(firstEmails?.rows[0]?.reviewHref, "/growth/outreach/messages/00000000-0000-0000-0000-0000000000m1");
  assert.equal(firstEmails?.rows[0]?.overdue, false);

  const followUps = state.data.workQueue.find((tab) => tab.kind === "follow_ups");
  assert.equal(followUps?.rows[0]?.overdue, true);
  assert.equal(state.data.defaultWorkQueueTab, "follow_ups");

  assert.equal(state.data.pipeline.totalValuePence, 1_100_000);
  assert.equal(state.data.upcomingActions.length, 1);
  assert.equal(state.data.sequenceHealth.deliveryRate, 0.98);

  for (const { text } of queries) {
    assert.doesNotMatch(text, /select\s+\*/i);
  }

  const boundedQueries = queries.filter((q) =>
    /"messageId"|"sequenceEnrollmentId"|"actionLabel"/.test(q.text),
  );
  assert.equal(boundedQueries.length, 4);
  for (const { text } of boundedQueries) {
    assert.match(text, /limit \?/);
  }
});

test("getOverviewViewModel excludes approved first-email tasks from review", async () => {
  const awaitingReview = (query: string) =>
    query.includes("draft.\"reviewState\" = 'draft'");
  const { db } = createFakeGrowthDb([
    {
      match: /"emailsWaitingForApproval"/,
      rows: (query) => [
        {
          emailsWaitingForApproval: awaitingReview(query) ? 0 : 1,
          repliesNeedingAttention: 1,
        },
      ],
    },
    {
      match: /"messageId"/,
      rows: (query) => (awaitingReview(query) ? [] : [firstEmailRow]),
    },
    ...baseRoutes(),
  ]);

  const state = await getOverviewViewModel(
    db,
    () => new Date("2026-08-16T08:00:00.000Z"),
  );

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  const firstEmails = state.data.workQueue.find((tab) => tab.kind === "first_emails");
  assert.equal(state.data.summary.emailsWaitingForApproval, 0);
  assert.equal(firstEmails?.totalCount, 0);
  assert.deepEqual(firstEmails?.rows, []);
});

test("getOverviewViewModel caps concurrent database reads", async () => {
  const routes = baseRoutes();
  let activeQueries = 0;
  let maximumActiveQueries = 0;

  const db = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    const route = routes.find(({ match }) => match.test(text));
    if (!route) {
      throw new Error(`No fake route matched query: ${text}`);
    }

    activeQueries += 1;
    maximumActiveQueries = Math.max(maximumActiveQueries, activeQueries);
    await new Promise<void>((resolve) => setImmediate(resolve));
    activeQueries -= 1;

    return route.rows;
  }) as unknown as GrowthQueryExecutor;

  const state = await getOverviewViewModel(
    db,
    () => new Date("2026-08-16T08:00:00.000Z"),
  );

  assert.equal(state.status, "ready");
  assert.ok(
    maximumActiveQueries <= 3,
    `expected at most 3 concurrent database reads, observed ${maximumActiveQueries}`,
  );
});

test("getOverviewViewModel keeps a bounded totalCount separate from capped rows", async () => {
  const cappedRows = Array.from({ length: 6 }, (_, index) =>
    buildFollowUpRow({
      prospectId: `follow-up-${index}`,
      totalCount: 9,
      statusAt: new Date("2026-08-16T00:00:00.000Z"),
    }),
  );

  const { db } = createFakeGrowthDb(baseRoutes({ followUps: cappedRows }));

  const state = await getOverviewViewModel(
    db,
    () => new Date("2026-08-16T08:00:00.000Z"),
    () => "unused-correlation-id",
  );

  assert.equal(state.status, "ready");
  if (state.status !== "ready") return;

  const followUps = state.data.workQueue.find((tab) => tab.kind === "follow_ups");
  assert.equal(followUps?.rows.length, 6);
  assert.equal(followUps?.totalCount, 9);
});

test("getOverviewViewModel reports an empty state with nothing to review", async () => {
  const { db } = createFakeGrowthDb(
    baseRoutes({
      summary: [{ emailsWaitingForApproval: 0, repliesNeedingAttention: 0 }],
      followUpsDueToday: [{ count: 0 }],
      lastRunDate: [{ lastRunDate: null }],
      firstEmails: [],
      replies: [],
      followUps: [],
      pipeline: [],
      upcomingActions: [],
      delivery: [{ sentCount: 0, failedCount: 0 }],
      enrollments: [{ sentEnrollmentCount: 0, repliedEnrollmentCount: 0 }],
    }),
  );

  const state = await getOverviewViewModel(db, () => new Date("2026-08-16T08:00:00.000Z"));

  assert.equal(state.status, "empty");
});

test("getOverviewViewModel fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const state = await getOverviewViewModel(
    db,
    () => new Date("2026-08-16T08:00:00.000Z"),
    () => "test-correlation-id",
  );

  assert.equal(state.status, "error");
  if (state.status !== "error") return;
  assert.equal(state.correlationId, "test-correlation-id");
  assert.doesNotMatch(state.message, /connection refused/);
});
