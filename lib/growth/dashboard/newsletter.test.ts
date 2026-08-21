import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  getEmailTemplateList,
  getEmailTemplateReview,
  getNewsletterIssueList,
  getNewsletterIssueReview,
} from "./newsletter";

const issueId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const templateId = "33333333-3333-4333-8333-333333333333";

const html = "<p>Hello {{unsubscribe_url}} world</p>";
const text = "Hello {{unsubscribe_url}} world";

function baseIssueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    issueId,
    issueKey: "august-field-note",
    version: 3,
    status: "ready_for_review",
    subject: "The local service website is becoming an operating system",
    previewText: "Three practical ways to turn enquiries into better work.",
    htmlSnapshot: html,
    textSnapshot: text,
    emailAssetId: assetId,
    testSentAt: new Date("2026-08-15T09:00:00.000Z"),
    testSentVersion: 3,
    approvedAt: null,
    approvedBy: null,
    approvedChecksum: null,
    scheduledFor: null,
    sentAt: null,
    createdBy: "founder",
    createdAt: new Date("2026-08-10T09:00:00.000Z"),
    updatedAt: new Date("2026-08-15T14:32:00.000Z"),
    ...overrides,
  };
}

function baseAssetRow() {
  return {
    url: "https://blob.example.public.blob.vercel-storage.com/growth-newsletter-assets/asset.webp",
    width: 1200,
    height: 630,
    byteSize: 141_000,
    altText: "Editorial visual of connected devices on a desk.",
    reviewStatus: "approved",
  };
}

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

function issueRoutesFor(overrides: {
  issue?: readonly object[];
  asset?: readonly object[];
  subscribers?: readonly object[];
}): FakeRoute[] {
  return [
    { match: /"previewText"/, rows: overrides.issue ?? [baseIssueRow()] },
    { match: /"reviewStatus"/, rows: overrides.asset ?? [baseAssetRow()] },
    {
      match: /from growth\.newsletter_subscribers/,
      rows: overrides.subscribers ?? [
        { status: "subscribed", count: "842" },
        { status: "unsubscribed", count: "12" },
        { status: "bounced", count: "3" },
        { status: "pending", count: "5" },
      ],
    },
  ];
}

test("getNewsletterIssueList returns issue summaries ordered by recent update", async () => {
  const db = createFakeGrowthDb([
    {
      match: /from growth\.newsletter_issues/,
      rows: [
        {
          issueId,
          issueKey: "august-field-note",
          subject: "The local service website is becoming an operating system",
          status: "ready_for_review",
          version: 3,
          scheduledFor: null,
          sentAt: null,
          updatedAt: new Date("2026-08-15T14:32:00.000Z"),
        },
      ],
    },
  ]);

  const result = await getNewsletterIssueList(db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.subject, "The local service website is becoming an operating system");
  assert.equal(result.rows[0]?.updatedAt, "2026-08-15T14:32:00.000Z");
});

test("getNewsletterIssueList fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getNewsletterIssueList(db, () => "test-correlation-id");
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});

test("getNewsletterIssueReview returns full HTML/text previews, checksum, subject, preheader, and audience counts", async () => {
  const db = createFakeGrowthDb(issueRoutesFor({}));
  const result = await getNewsletterIssueReview(issueId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.subject, baseIssueRow().subject);
  assert.equal(
    result.data.previewText,
    "Three practical ways to turn enquiries into better work.",
  );
  assert.equal(result.data.htmlSnapshot, html);
  assert.equal(result.data.textSnapshot, text);
  assert.match(result.data.checksum, /^[0-9a-f]{64}$/);
  assert.equal(result.data.audience.eligibleCount, 842);
  assert.equal(result.data.audience.suppressedCount, 15);
  assert.equal(result.data.audience.pendingCount, 5);
  assert.equal(result.data.asset?.altText, baseAssetRow().altText);
  assert.equal(result.data.isTestCurrent, true);
  assert.equal(result.data.isLocked, false);
});

test("getNewsletterIssueReview marks the unsubscribe placeholder present in both snapshots", async () => {
  const db = createFakeGrowthDb(issueRoutesFor({}));
  const result = await getNewsletterIssueReview(issueId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.match(result.data.htmlSnapshot, /\{\{unsubscribe_url\}\}/);
  assert.match(result.data.textSnapshot, /\{\{unsubscribe_url\}\}/);
});

test("getNewsletterIssueReview reports a stale founder test once the snapshot changes version", async () => {
  const db = createFakeGrowthDb(
    issueRoutesFor({
      issue: [baseIssueRow({ version: 4, testSentVersion: 3 })],
    }),
  );
  const result = await getNewsletterIssueReview(issueId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.isTestCurrent, false);
});

test("getNewsletterIssueReview reports the approved state as immutable/locked", async () => {
  const db = createFakeGrowthDb(
    issueRoutesFor({
      issue: [
        baseIssueRow({
          status: "approved",
          approvedAt: new Date("2026-08-16T10:00:00.000Z"),
          approvedBy: "founder",
          approvedChecksum:
            "5a5f9e5462c0f8f8c1a0b7f8d1d8d5d9d5d9d5d9d5d9d5d9d5d9d5d9d5d9d5d9",
        }),
      ],
    }),
  );
  const result = await getNewsletterIssueReview(issueId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.isLocked, true);
  assert.equal(result.data.isApprovalCurrent, false);
});

test("getNewsletterIssueReview reports no asset when the issue has none", async () => {
  const db = createFakeGrowthDb(
    issueRoutesFor({ issue: [baseIssueRow({ emailAssetId: null })] }),
  );
  const result = await getNewsletterIssueReview(issueId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.asset, null);
});

test("getNewsletterIssueReview returns not_found for a malformed ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getNewsletterIssueReview("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getNewsletterIssueReview returns not_found for a missing issue", async () => {
  const db = createFakeGrowthDb(issueRoutesFor({ issue: [] }));
  const result = await getNewsletterIssueReview(issueId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getNewsletterIssueReview fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getNewsletterIssueReview(
    issueId,
    db,
    () => "test-correlation-id",
  );
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});

function baseTemplateListRow() {
  return {
    templateId,
    templateKey: "site-enquiry-thank-you",
    category: "transactional",
    status: "draft",
    version: "1.0",
    publishedAt: null,
    publishedBy: null,
  };
}

test("getEmailTemplateList returns only resend-channel templates", async () => {
  const db = createFakeGrowthDb([
    { match: /from growth\.email_templates/, rows: [baseTemplateListRow()] },
  ]);
  const result = await getEmailTemplateList(db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.templateKey, "site-enquiry-thank-you");
});

test("getEmailTemplateList fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;
  const result = await getEmailTemplateList(db, () => "test-correlation-id");
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
});

function baseTemplateReviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...baseTemplateListRow(),
    subjectTemplate: "We received your request",
    htmlTemplate: "<p>Hi {{firstName}},</p><p>Thank you, {{businessName}}.</p>",
    textTemplate: "Hi {{firstName}},\n\nThank you, {{businessName}}.",
    requiredFields: ["firstName", "businessName"],
    checksum: "b".repeat(64),
    ...overrides,
  };
}

test("getEmailTemplateReview fills every placeholder with safe representative fixture data", async () => {
  const db = createFakeGrowthDb([
    { match: /"htmlTemplate"/, rows: [baseTemplateReviewRow()] },
  ]);
  const result = await getEmailTemplateReview(templateId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.doesNotMatch(result.data.renderedHtml, /\{\{/);
  assert.doesNotMatch(result.data.renderedText, /\{\{/);
  assert.match(result.data.renderedHtml, /Daniel/);
  assert.match(result.data.renderedHtml, /Smith & Sons Plumbing Ltd/);
  assert.equal(result.data.renderedSubject, "We received your request");
  assert.equal(result.data.checksum, "b".repeat(64));
  assert.deepEqual(result.data.fixtureFields, {
    firstName: "Daniel",
    businessName: "Smith & Sons Plumbing Ltd",
  });
});

test("getEmailTemplateReview leaves an unrecognised placeholder as a labelled bracket rather than blank", async () => {
  const db = createFakeGrowthDb([
    {
      match: /"htmlTemplate"/,
      rows: [
        baseTemplateReviewRow({
          htmlTemplate: "<p>{{somethingNew}}</p>",
          textTemplate: "{{somethingNew}}",
          requiredFields: ["somethingNew"],
        }),
      ],
    },
  ]);
  const result = await getEmailTemplateReview(templateId, db);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.match(result.data.renderedHtml, /\[somethingNew\]/);
});

test("getEmailTemplateReview returns not_found for a malformed ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getEmailTemplateReview("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getEmailTemplateReview returns not_found for a missing template", async () => {
  const db = createFakeGrowthDb([{ match: /"htmlTemplate"/, rows: [] }]);
  const result = await getEmailTemplateReview(templateId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getEmailTemplateReview fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;
  const result = await getEmailTemplateReview(
    templateId,
    db,
    () => "test-correlation-id",
  );
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
});
