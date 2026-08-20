import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { getVisualConcept, getWebsiteStrategy } from "./website-strategy";

const prospectId = "22222222-2222-4222-8222-222222222222";

function section(label: string) {
  return {
    schemaVersion: "1.0",
    summary: `${label} summary`,
    items: [`${label} item 1`, `${label} item 2`],
  };
}

function baseAssessmentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    businessGoal: "Convert enquiries into booked call-backs.",
    primaryCta: "Request a call-back",
    sitemap: section("Sitemap"),
    homepageSections: section("Homepage"),
    conversionPlan: section("Conversion"),
    localSeoPlan: section("Local SEO"),
    trustSignals: section("Trust"),
    technologyPlan: section("Technology"),
    futureOpportunities: section("Future"),
    heroConcept: section("Hero"),
    mobileFallback: section("Mobile"),
    performanceBudget: section("Performance"),
    status: "draft",
    reviewedAt: null,
    businessName: "Smith & Sons Plumbing Ltd",
    sector: "plumbing",
    locality: "Leeds",
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    ...overrides,
  };
}

function baseEvidenceRow() {
  return {
    id: "e1",
    sourceType: "companies_house",
    sourceUrl:
      "https://find-and-update.company-information.service.gov.uk/company/12345678",
    claimSummary: "Active limited company.",
    verifiedAt: new Date("2026-08-15T05:20:00.000Z"),
  };
}

function baseAssetRow() {
  return {
    url: "https://blob.example.public.blob.vercel-storage.com/growth-email-assets/33333333-3333-4333-8333-333333333333.webp",
    width: 1200,
    height: 630,
    byteSize: 120_000,
    altText: "Concept showing a booking flow.",
    sha256: "a".repeat(64),
    reviewStatus: "approved",
    createdBy: "agent",
    createdAt: new Date("2026-08-15T06:00:00.000Z"),
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

function routesFor(overrides: {
  assessment?: readonly object[];
  evidence?: readonly object[];
  asset?: readonly object[];
}): FakeRoute[] {
  return [
    { match: /"businessGoal"/, rows: overrides.assessment ?? [baseAssessmentRow()] },
    { match: /"claimSummary"/, rows: overrides.evidence ?? [baseEvidenceRow()] },
    { match: /"reviewStatus"/, rows: overrides.asset ?? [baseAssetRow()] },
  ];
}

test("getWebsiteStrategy returns the 8 brief sections, prospect summary, and evidence", async () => {
  const db = createFakeGrowthDb(routesFor({}));
  const result = await getWebsiteStrategy(prospectId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.businessName, "Smith & Sons Plumbing Ltd");
  assert.equal(result.data.fitScore, 91);
  assert.equal(result.data.status, "draft");
  assert.equal(result.data.reviewedAt, null);
  assert.equal(result.data.businessGoal, "Convert enquiries into booked call-backs.");
  assert.equal(result.data.primaryCta, "Request a call-back");
  assert.deepEqual(result.data.conversionPlan.items, [
    "Conversion item 1",
    "Conversion item 2",
  ]);
  assert.equal(result.data.sitemap.summary, "Sitemap summary");
  assert.equal(result.data.homepageSections.summary, "Homepage summary");
  assert.equal(result.data.trustSignals.summary, "Trust summary");
  assert.equal(result.data.localSeoPlan.summary, "Local SEO summary");
  assert.equal(result.data.technologyPlan.summary, "Technology summary");
  assert.equal(result.data.futureOpportunities.summary, "Future summary");
  assert.equal(result.data.evidence.length, 1);
  assert.equal(result.data.evidence[0]?.sourceType, "companies_house");
  assert.equal(result.data.evidence[0]?.verifiedAt, "2026-08-15T05:20:00.000Z");
});

test("getWebsiteStrategy reports the reviewed timestamp once a founder has reviewed it", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      assessment: [
        baseAssessmentRow({
          status: "reviewed",
          reviewedAt: new Date("2026-08-16T09:00:00.000Z"),
        }),
      ],
    }),
  );
  const result = await getWebsiteStrategy(prospectId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.status, "reviewed");
  assert.equal(result.data.reviewedAt, "2026-08-16T09:00:00.000Z");
});

test("getWebsiteStrategy returns not_found for a malformed prospect ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getWebsiteStrategy("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getWebsiteStrategy returns not_found when no assessment row exists", async () => {
  const db = createFakeGrowthDb(routesFor({ assessment: [] }));
  const result = await getWebsiteStrategy(prospectId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getWebsiteStrategy fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getWebsiteStrategy(prospectId, db, () => "test-correlation-id");

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});

test("getWebsiteStrategy fails safe when a JSONB section fails schema validation", async () => {
  const db = createFakeGrowthDb(
    routesFor({
      assessment: [baseAssessmentRow({ sitemap: { not: "a valid section" } })],
    }),
  );
  const result = await getWebsiteStrategy(prospectId, db, () => "test-correlation-id");

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
});

test("getVisualConcept returns the 3 visual sections, prospect summary, and stored asset", async () => {
  const db = createFakeGrowthDb(routesFor({}));
  const result = await getVisualConcept(prospectId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.businessName, "Smith & Sons Plumbing Ltd");
  assert.equal(result.data.heroConcept.summary, "Hero summary");
  assert.equal(result.data.mobileFallback.summary, "Mobile summary");
  assert.equal(result.data.performanceBudget.summary, "Performance summary");
  assert.ok(result.data.asset);
  assert.equal(result.data.asset?.reviewStatus, "approved");
  assert.equal(result.data.asset?.createdAt, "2026-08-15T06:00:00.000Z");
});

test("getVisualConcept reports a null asset when no visual has been generated yet", async () => {
  const db = createFakeGrowthDb(routesFor({ asset: [] }));
  const result = await getVisualConcept(prospectId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.data.asset, null);
});

test("getVisualConcept returns not_found for a malformed prospect ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getVisualConcept("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getVisualConcept returns not_found when no assessment row exists", async () => {
  const db = createFakeGrowthDb(routesFor({ assessment: [] }));
  const result = await getVisualConcept(prospectId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("getVisualConcept fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getVisualConcept(prospectId, db, () => "test-correlation-id");

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});
