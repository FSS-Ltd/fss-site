import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { ProspectDetail } from "@/lib/growth/dashboard/prospect-detail";
import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { evaluateApprovalReadiness, ProspectActionsFrame } =
  require("./prospect-actions") as typeof import("./prospect-actions");

const NOW = "2026-08-16T08:00:00.000Z";

const healthyIntegrations: readonly IntegrationHealth[] = [
  { provider: "gmail", status: "healthy", checkedAt: NOW, message: "Gmail connected" },
];

function baseProspect(overrides: Partial<ProspectDetail> = {}): ProspectDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    version: 3,
    status: "qualified",
    fitScore: 91,
    opportunitySummary: "No website, slow enquiry handling",
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    estimatedMonthlyPence: 25_000,
    nextAction: "Review first email",
    nextActionDueAt: null,
    createdAt: "2026-08-10T09:00:00.000Z",
    business: {
      legalName: "Smith & Sons Plumbing Ltd",
      tradingName: null,
      companyNumber: "12345678",
      corporateType: "limited_company",
      corporateStatus: "active",
      sector: "Plumbing",
      locality: "Maidstone",
      websiteUrl: null,
      googlePlaceId: "place-1",
      googleMapsReferenceUrl: "https://maps.example/place-1",
      verifiedAt: "2026-08-15T06:00:00.000Z",
    },
    contact: {
      firstName: "Daniel",
      lastName: "Smith",
      roleTitle: "Director",
      email: "daniel@smithandsonsplumbing.co.uk",
      emailSourceUrl: "https://smithandsonsplumbing.co.uk/contact",
      emailVerifiedAt: "2026-08-15T06:30:00.000Z",
      subscriberType: "corporate",
      lawfulBasis: "legitimate_interests",
    },
    websiteAssessment: null,
    preview: null,
    visualAsset: {
      blobUrl: "https://blob.example/hero.webp",
      altText: "A generated concept hero image for the plumbing business",
      width: 1200,
      height: 630,
      reviewStatus: "approved",
      createdAt: "2026-08-15T07:00:00.000Z",
    },
    sequence: null,
    evidence: [],
    auditSummary: [],
    ...overrides,
  };
}

test("evaluateApprovalReadiness is ready when every sensitive condition is clear", () => {
  const readiness = evaluateApprovalReadiness(
    baseProspect(),
    healthyIntegrations,
    NOW,
  );
  assert.deepEqual(readiness, { ready: true, reasons: [] });
});

test("evaluateApprovalReadiness blocks a suppressed prospect", () => {
  const readiness = evaluateApprovalReadiness(
    baseProspect({ status: "suppressed" }),
    healthyIntegrations,
    NOW,
  );
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.some((reason) => /suppressed/.test(reason)));
});

test("evaluateApprovalReadiness blocks an uncertain corporate status", () => {
  const readiness = evaluateApprovalReadiness(
    baseProspect({
      business: { ...baseProspect().business, corporateStatus: "uncertain" },
    }),
    healthyIntegrations,
    NOW,
  );
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.some((reason) => /corporate status/.test(reason)));
});

test("evaluateApprovalReadiness blocks missing contact evidence", () => {
  const readiness = evaluateApprovalReadiness(
    baseProspect({ contact: null }),
    healthyIntegrations,
    NOW,
  );
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.some((reason) => /verified contact/.test(reason)));
});

test("evaluateApprovalReadiness blocks stale research older than 30 days", () => {
  const readiness = evaluateApprovalReadiness(
    baseProspect({
      business: {
        ...baseProspect().business,
        verifiedAt: "2026-07-01T00:00:00.000Z",
      },
    }),
    healthyIntegrations,
    NOW,
  );
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.some((reason) => /30 days/.test(reason)));
});

test("evaluateApprovalReadiness blocks a missing or failed visual asset", () => {
  const missing = evaluateApprovalReadiness(
    baseProspect({ visualAsset: null }),
    healthyIntegrations,
    NOW,
  );
  assert.ok(missing.reasons.some((reason) => /visual/.test(reason)));

  const rejected = evaluateApprovalReadiness(
    baseProspect({
      visualAsset: { ...baseProspect().visualAsset!, reviewStatus: "rejected" },
    }),
    healthyIntegrations,
    NOW,
  );
  assert.ok(rejected.reasons.some((reason) => /visual/.test(reason)));
});

test("evaluateApprovalReadiness blocks a disconnected Gmail integration", () => {
  const readiness = evaluateApprovalReadiness(baseProspect(), [
    { provider: "gmail", status: "disconnected", checkedAt: NOW, message: "Not connected" },
  ], NOW);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.some((reason) => /Gmail/.test(reason)));
});

function renderActions(
  prospect: ProspectDetail = baseProspect(),
  integrations: readonly IntegrationHealth[] = healthyIntegrations,
): string {
  return renderToStaticMarkup(
    <ProspectActionsFrame
      integrations={integrations}
      now={NOW}
      onSuccess={() => {}}
      prospect={prospect}
    />,
  );
}

test("renders every founder action with a labelled button", () => {
  const html = renderActions();

  assert.match(html, />Re-research<\/button>/);
  assert.match(html, />Reject<\/button>/);
  assert.match(html, />Do not contact<\/button>/);
  assert.match(html, />Started talks<\/button>/);
  assert.match(html, />Pause<\/button>/);
});

test("disables every status-transition action once a prospect is in a terminal state", () => {
  const html = renderActions(baseProspect({ status: "rejected" }));

  assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Re-research<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Reject<\/button>/);
});

test("disables pause with an explanation when there is no active sequence", () => {
  const html = renderActions(baseProspect({ sequence: null }));

  assert.match(html, /<button[^>]*disabled=""[^>]*>\s*Pause<\/button>/);
  assert.match(html, /No active sequence to pause yet\./);
});

test("enables pause when the sequence is still active", () => {
  const html = renderActions(
    baseProspect({
      sequence: {
        id: "22222222-2222-4222-8222-222222222222",
        status: "active",
        currentStep: 1,
        startedAt: "2026-08-15T09:00:00.000Z",
        stoppedAt: null,
        stopReason: null,
      },
    }),
  );

  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Pause<\/button>/,
  );
});

test("explains why approval is blocked without relying on colour alone", () => {
  const html = renderActions(baseProspect({ status: "suppressed" }));

  assert.match(html, /Approval is blocked until these are resolved:/);
  assert.match(html, /This prospect is suppressed and cannot be contacted\./);
});

test("shows a ready message when nothing blocks approval", () => {
  const html = renderActions();
  assert.match(html, /Ready for founder review\./);
});
