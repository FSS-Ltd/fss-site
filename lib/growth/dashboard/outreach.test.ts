import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { getOutreachDetail, getOutreachList } from "./outreach";

const sequenceId = "11111111-1111-4111-8111-111111111111";
const prospectId = "22222222-2222-4222-8222-222222222222";

type FakeRoute = { match: RegExp; rows: readonly object[] };

function createFakeGrowthDb(routes: readonly FakeRoute[]): GrowthQueryExecutor {
  const query = async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    const route = routes.find(({ match }) => match.test(text));
    if (!route) throw new Error(`No fake route matched query: ${text}`);
    return route.rows;
  };
  return query as unknown as GrowthQueryExecutor;
}

function baseEnrollmentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sequenceId,
    prospectId,
    status: "active",
    currentStep: 1,
    stopReason: null,
    stoppedAt: null,
    startedAt: new Date("2026-08-15T09:12:00.000Z"),
    gmailThreadId: "thread-abc",
    businessName: "Smith & Sons Plumbing Ltd",
    websiteUrl: null,
    contactFirstName: "Daniel",
    contactLastName: "Smith",
    contactEmail: "daniel@smithandsonsplumbing.co.uk",
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    ...overrides,
  };
}

function outboundSent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m1",
    direction: "outbound" as const,
    stepNumber: 0,
    status: "sent",
    scheduledFor: null,
    sentAt: new Date("2026-08-15T09:12:00.000Z"),
    receivedAt: null,
    lastErrorSummary: null,
    updatedAt: new Date("2026-08-15T09:12:00.000Z"),
    eventType: null,
    eventOccurredAt: null,
    eventCreatedAt: null,
    ...overrides,
  };
}

function outboundScheduled(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m2",
    direction: "outbound" as const,
    stepNumber: 1,
    status: "queued",
    scheduledFor: new Date("2026-08-20T09:12:00.000Z"),
    sentAt: null,
    receivedAt: null,
    lastErrorSummary: null,
    updatedAt: new Date("2026-08-15T09:12:00.000Z"),
    eventType: null,
    eventOccurredAt: null,
    eventCreatedAt: null,
    ...overrides,
  };
}

function inboundReply(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "m3",
    direction: "inbound" as const,
    stepNumber: 0,
    status: "received",
    scheduledFor: null,
    sentAt: null,
    receivedAt: new Date("2026-08-16T14:45:00.000Z"),
    lastErrorSummary: null,
    updatedAt: new Date("2026-08-16T14:45:00.000Z"),
    eventType: "reply",
    eventOccurredAt: new Date("2026-08-16T14:45:00.000Z"),
    eventCreatedAt: new Date("2026-08-16T14:47:30.000Z"),
    ...overrides,
  };
}

function routesFor(overrides: {
  enrollment?: readonly object[];
  messages?: readonly object[];
  audits?: readonly object[];
  seoAudits?: readonly object[];
  gmailSync?: readonly object[];
}): FakeRoute[] {
  return [
    {
      match: /"businessName"/,
      rows: overrides.enrollment ?? [baseEnrollmentRow()],
    },
    {
      match: /"eventType"/,
      rows: overrides.messages ?? [outboundSent(), outboundScheduled()],
    },
    { match: /from growth\.audit_log/, rows: overrides.audits ?? [] },
    { match: /from growth\.seo_audit_drafts/, rows: overrides.seoAudits ?? [] },
    {
      match: /from growth\.integration_connections/,
      rows: overrides.gmailSync ?? [
        { lastSyncedAt: new Date("2026-08-16T14:45:00.000Z") },
      ],
    },
  ];
}

test("getOutreachList returns bounded rows with a safe contact-name fallback", async () => {
  const db = createFakeGrowthDb([
    {
      match: /"contactName"/,
      rows: [
        {
          sequenceId,
          prospectId,
          businessName: "Smith & Sons Plumbing Ltd",
          contactName: "Daniel Smith",
          status: "active",
          currentStep: 1,
          lastActivityAt: new Date("2026-08-16T14:45:00.000Z"),
        },
        {
          sequenceId: "33333333-3333-4333-8333-333333333333",
          prospectId: "44444444-4444-4444-8444-444444444444",
          businessName: "Kent Auto Care Ltd",
          contactName: null,
          status: "paused",
          currentStep: 0,
          lastActivityAt: new Date("2026-08-15T09:00:00.000Z"),
        },
      ],
    },
  ]);

  const result = await getOutreachList(db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.contactName, "Daniel Smith");
  assert.equal(result.rows[1]?.contactName, "Unnamed contact");
});

test("getOutreachDetail returns current step, stop reason, contact, and fit/offer summary", async () => {
  const db = createFakeGrowthDb(routesFor({}));
  const result = await getOutreachDetail(sequenceId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.businessName, "Smith & Sons Plumbing Ltd");
  assert.equal(result.data.contactName, "Daniel Smith");
  assert.equal(result.data.currentStep, 1);
  assert.equal(result.data.stopReason, null);
  assert.equal(result.data.fitScore, 91);
  assert.deepEqual(result.data.seoAudit, { state: "not_started" });
});

test("exposes a direct founder-review state once an SEO audit is ready", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      seoAudits: [
        {
          auditId: "33333333-3333-4333-8333-333333333333",
          status: "draft",
          claimExpiresAt: null,
          completedAt: new Date("2026-09-01T12:00:00.000Z"),
          approvedAt: null,
        },
      ],
    }),
  );

  const result = await getOutreachDetail(sequenceId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.data.seoAudit, {
    state: "draft",
    auditId: "33333333-3333-4333-8333-333333333333",
    completedAt: "2026-09-01T12:00:00.000Z",
  });
});

test("keeps a claimed SEO audit visible while its claim is recoverable", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      seoAudits: [
        {
          auditId: "33333333-3333-4333-8333-333333333333",
          status: "claimed",
          claimExpiresAt: new Date("2026-09-01T14:46:10.085Z"),
          completedAt: null,
          approvedAt: null,
        },
      ],
    }),
  );

  const result = await getOutreachDetail(sequenceId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.data.seoAudit, {
    state: "claimed",
    claimExpiresAt: "2026-09-01T14:46:10.085Z",
  });
});

test("shows the actual replacement reason for a cancelled Day 11 placeholder", async () => {
  const result = await getOutreachDetail(
    sequenceId,
    createFakeGrowthDb(
      routesFor({
        messages: [
          outboundScheduled({
            id: "audit-placeholder",
            stepNumber: 2,
            status: "cancelled",
            scheduledFor: new Date("2026-09-07T09:00:00.000Z"),
            lastErrorSummary:
              "Replaced by the founder-approved SEO and AEO audit follow-up.",
          }),
        ],
      }),
    ),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(
    result.data.timeline[0]?.detail,
    "Replaced by the founder-approved SEO and AEO audit follow-up.",
  );
});

test("constructs a safe Gmail mailbox URL only when a thread ID exists", async () => {
  const withThread = await getOutreachDetail(
    sequenceId,
    createFakeGrowthDb(routesFor({})),
  );
  assert.equal(withThread.status, "ready");
  if (withThread.status !== "ready") return;
  assert.equal(
    withThread.data.gmailThreadUrl,
    "https://mail.google.com/mail/u/0/#all/thread-abc",
  );

  const withoutThread = await getOutreachDetail(
    sequenceId,
    createFakeGrowthDb(
      routesFor({ enrollment: [baseEnrollmentRow({ gmailThreadId: null })] }),
    ),
  );
  assert.equal(withoutThread.status, "ready");
  if (withoutThread.status !== "ready") return;
  assert.equal(withoutThread.data.gmailThreadUrl, null);
});

test("reports provider health: delivered/replied counts and last Gmail sync", async () => {
  const db = createFakeGrowthDb(
    routesFor({ messages: [outboundSent(), inboundReply()] }),
  );
  const result = await getOutreachDetail(sequenceId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.threadHealth.deliveredCount, 1);
  assert.equal(result.data.threadHealth.repliedCount, 1);
  assert.equal(
    result.data.threadHealth.lastGmailSyncAt,
    "2026-08-16T14:45:00.000Z",
  );
});

test("orders timeline events deterministically: scheduled, sent, reply, then founder actions", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      messages: [
        outboundScheduled({
          id: "m-scheduled",
          scheduledFor: new Date("2026-08-20T09:12:00.000Z"),
        }),
        outboundSent({
          id: "m-sent",
          sentAt: new Date("2026-08-15T09:12:00.000Z"),
        }),
        inboundReply({
          id: "m-reply",
          eventOccurredAt: new Date("2026-08-16T14:45:00.000Z"),
        }),
      ],
      audits: [
        {
          action: "sequence.stopped.pause",
          createdAt: new Date("2026-08-17T10:00:00.000Z"),
        },
      ],
    }),
  );

  const result = await getOutreachDetail(sequenceId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(
    result.data.timeline.map((event) => event.kind),
    ["sent", "reply", "paused", "scheduled"],
  );
});

test("distinguishes provider observation time from local receipt time on a reply", async () => {
  const db = createFakeGrowthDb(routesFor({ messages: [inboundReply()] }));
  const result = await getOutreachDetail(sequenceId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  const reply = result.data.timeline.find((event) => event.kind === "reply");
  assert.ok(reply);
  assert.equal(reply?.providerObservedAt, "2026-08-16T14:45:00.000Z");
  assert.equal(reply?.localReceivedAt, "2026-08-16T14:47:30.000Z");
  assert.notEqual(reply?.providerObservedAt, reply?.localReceivedAt);
});

test("never queries reply body columns for the timeline", async () => {
  const queries: string[] = [];
  const db = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push(text);
    if (text.includes('"businessName"')) return [baseEnrollmentRow()];
    if (text.includes('"eventType"')) return [inboundReply()];
    if (text.includes("growth.audit_log")) return [];
    if (text.includes("growth.seo_audit_drafts")) return [];
    if (text.includes("growth.integration_connections"))
      return [{ lastSyncedAt: null }];
    throw new Error(`Unexpected query: ${text}`);
  }) as unknown as GrowthQueryExecutor;

  await getOutreachDetail(sequenceId, db);

  for (const text of queries) {
    assert.doesNotMatch(text, /html_snapshot|text_snapshot/);
  }
});

test("marks a paused sequence resumable and everything else not", async () => {
  const paused = await getOutreachDetail(
    sequenceId,
    createFakeGrowthDb(
      routesFor({ enrollment: [baseEnrollmentRow({ status: "paused" })] }),
    ),
  );
  assert.equal(paused.status, "ready");
  if (paused.status !== "ready") return;
  assert.equal(paused.data.resumable, true);

  const active = await getOutreachDetail(
    sequenceId,
    createFakeGrowthDb(routesFor({})),
  );
  assert.equal(active.status, "ready");
  if (active.status !== "ready") return;
  assert.equal(active.data.resumable, false);
});

test("rejects a malformed sequence ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getOutreachDetail("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("reports not_found for a missing sequence", async () => {
  const db = createFakeGrowthDb(routesFor({ enrollment: [] }));
  const result = await getOutreachDetail(sequenceId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getOutreachDetail(
    sequenceId,
    db,
    () => "test-correlation-id",
  );
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});
