import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import { getProspectDetail } from "./prospect-detail";

const prospectId = "11111111-1111-4111-8111-111111111111";

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

const coreRow = {
  id: prospectId,
  version: 4,
  status: "qualified" as const,
  fitScore: 91,
  opportunitySummary: "No website, slow enquiry handling",
  recommendedOffer: "Website + AI Enquiry Agent",
  estimatedOneOffMinPence: 300_000,
  estimatedOneOffMaxPence: 600_000,
  estimatedMonthlyPence: 25_000,
  nextAction: "Review first email",
  nextActionDueAt: new Date("2026-08-18T09:00:00.000Z"),
  createdAt: new Date("2026-08-15T09:00:00.000Z"),
  businessLegalName: "Smith & Sons Plumbing Ltd",
  businessTradingName: null,
  businessCompanyNumber: "12345678",
  businessCorporateType: "limited_company",
  businessCorporateStatus: "active",
  businessSector: "Plumbing",
  businessLocality: "Maidstone",
  businessWebsiteUrl: null,
  businessGooglePlaceId: "place-1",
  businessGoogleMapsReferenceUrl: "https://maps.example/place-1",
  businessVerifiedAt: new Date("2026-08-15T06:00:00.000Z"),
  contactFirstName: "Daniel",
  contactLastName: "Smith",
  contactRoleTitle: "Director",
  contactEmail: "daniel@smithandsonsplumbing.co.uk",
  contactEmailSourceUrl: "https://smithandsonsplumbing.co.uk/contact",
  contactEmailVerifiedAt: new Date("2026-08-15T06:30:00.000Z"),
  contactSubscriberType: "corporate",
  contactLawfulBasis: "legitimate_interests",
  websiteBusinessGoal: "Capture more enquiries",
  websitePrimaryCta: "Request a quote",
  websiteStatus: "ready",
  websiteReviewedAt: null,
  previewStatus: "draft",
  previewVersion: 1,
  visualBlobUrl: "https://blob.example/hero.webp",
  visualAltText: "A generated concept hero image for the plumbing business",
  visualWidth: 1200,
  visualHeight: 630,
  visualReviewStatus: "approved",
  visualCreatedAt: new Date("2026-08-15T07:00:00.000Z"),
  sequenceId: "22222222-2222-4222-8222-222222222222",
  sequenceStatus: "active",
  sequenceCurrentStep: 1,
  sequenceStartedAt: new Date("2026-08-16T10:00:00.000Z"),
  sequenceStoppedAt: null,
  sequenceStopReason: null,
};

function routesFor(overrides: {
  core?: readonly object[];
  evidence?: readonly object[];
  audit?: readonly object[];
}): FakeRoute[] {
  return [
    { match: /"businessLegalName"/, rows: overrides.core ?? [coreRow] },
    { match: /"sourceType"/, rows: overrides.evidence ?? [
      {
        id: "e1",
        sourceType: "google_business_profile",
        sourceUrl: "https://maps.google.com/place-1",
        claimType: "no_website",
        claimSummary: "No active website found",
        observedAt: new Date("2026-08-14T00:00:00.000Z"),
        verifiedAt: new Date("2026-08-15T00:00:00.000Z"),
      },
    ] },
    { match: /from growth\.audit_log/, rows: overrides.audit ?? [
      { action: "prospect.status_transitioned.started_talks", actorType: "founder", createdAt: new Date("2026-08-16T09:00:00.000Z") },
    ] },
  ];
}

test("returns full detail for one prospect: business, corporate verification, contact provenance, fit rationale, website observations, sequence state, and audit summary", async () => {
  const db = createFakeGrowthDb(routesFor({}));

  const result = await getProspectDetail(prospectId, db);

  assert.equal(result.status, "found");
  if (result.status !== "found") return;

  assert.equal(result.data.business.legalName, "Smith & Sons Plumbing Ltd");
  assert.equal(result.data.business.corporateStatus, "active");
  assert.equal(result.data.contact?.email, "daniel@smithandsonsplumbing.co.uk");
  assert.equal(result.data.contact?.lawfulBasis, "legitimate_interests");
  assert.equal(result.data.fitScore, 91);
  assert.equal(result.data.opportunitySummary, "No website, slow enquiry handling");
  assert.equal(result.data.websiteAssessment?.businessGoal, "Capture more enquiries");
  assert.deepEqual(result.data.preview, { status: "draft", version: 1 });
  assert.equal((result.data.visualAsset?.altText.length ?? 0) > 0, true);
  assert.equal(result.data.sequence?.status, "active");
  assert.equal(result.data.evidence.length, 1);
  assert.equal(result.data.evidence[0]?.sourceType, "google_business_profile");
  assert.equal(result.data.auditSummary.length, 1);
  assert.equal(result.data.auditSummary[0]?.action, "prospect.status_transitioned.started_talks");
  assert.equal(result.data.version, 4);
});

test("does not render Google review, rating, or listing text — only discovery references", async () => {
  const db = createFakeGrowthDb(routesFor({}));
  const result = await getProspectDetail(prospectId, db);

  assert.equal(result.status, "found");
  if (result.status !== "found") return;

  assert.equal(result.data.business.googlePlaceId, "place-1");
  assert.equal(
    result.data.business.googleMapsReferenceUrl,
    "https://maps.example/place-1",
  );
});

test("returns null relations gracefully when a prospect has no contact, website assessment, visual asset, or sequence", async () => {
  const bareCore = {
    ...coreRow,
    contactFirstName: null,
    contactLastName: null,
    contactRoleTitle: null,
    contactEmail: null,
    contactEmailSourceUrl: null,
    contactEmailVerifiedAt: null,
    contactSubscriberType: null,
    contactLawfulBasis: null,
    websiteBusinessGoal: null,
    websitePrimaryCta: null,
    websiteStatus: null,
    websiteReviewedAt: null,
    visualBlobUrl: null,
    visualAltText: null,
    visualWidth: null,
    visualHeight: null,
    visualReviewStatus: null,
    visualCreatedAt: null,
    sequenceId: null,
    sequenceStatus: null,
    sequenceCurrentStep: null,
    sequenceStartedAt: null,
    sequenceStoppedAt: null,
    sequenceStopReason: null,
  };
  const db = createFakeGrowthDb(
    routesFor({ core: [bareCore], evidence: [], audit: [] }),
  );

  const result = await getProspectDetail(prospectId, db);
  assert.equal(result.status, "found");
  if (result.status !== "found") return;

  assert.equal(result.data.contact, null);
  assert.equal(result.data.websiteAssessment, null);
  assert.equal(result.data.visualAsset, null);
  assert.equal(result.data.sequence, null);
  assert.equal(result.data.evidence.length, 0);
});

test("rejects a malformed prospect ID without querying the database", async () => {
  const db = createFakeGrowthDb([]);
  const result = await getProspectDetail("not-a-uuid", db);
  assert.deepEqual(result, { status: "not_found" });
});

test("reports not_found for a missing or deleted prospect", async () => {
  const db = createFakeGrowthDb(routesFor({ core: [] }));
  const result = await getProspectDetail(prospectId, db);
  assert.deepEqual(result, { status: "not_found" });
});

test("fails safe with a correlation ID when a query throws", async () => {
  const db = (async () => {
    throw new Error("connection refused");
  }) as unknown as GrowthQueryExecutor;

  const result = await getProspectDetail(prospectId, db, () => "test-correlation-id");

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.correlationId, "test-correlation-id");
  assert.doesNotMatch(result.message, /connection refused/);
});
