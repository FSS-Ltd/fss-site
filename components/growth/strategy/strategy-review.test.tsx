import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  VisualConceptData,
  WebsiteStrategyData,
} from "@/lib/growth/dashboard/website-strategy";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { StrategyReview } =
  require("./strategy-review") as typeof import("./strategy-review");
const { VisualConcept } =
  require("./visual-concept") as typeof import("./visual-concept");

function section(label: string) {
  return {
    summary: `${label} summary sentence.`,
    items: [`${label} observation one`, `${label} observation two`],
  };
}

function baseStrategyData(
  overrides: Partial<WebsiteStrategyData> = {},
): WebsiteStrategyData {
  return {
    prospectId: "22222222-2222-4222-8222-222222222222",
    businessName: "Smith & Sons Plumbing Ltd",
    sector: "Plumbing",
    locality: "Leeds",
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    status: "draft",
    reviewedAt: null,
    businessGoal: "Convert emergency call-outs into booked jobs.",
    primaryCta: "Request a call-back",
    conversionPlan: section("Conversion"),
    sitemap: section("Sitemap"),
    homepageSections: section("Homepage"),
    trustSignals: section("Trust"),
    localSeoPlan: section("Local SEO"),
    technologyPlan: section("Technology"),
    futureOpportunities: section("Future"),
    evidence: [
      {
        id: "e1",
        sourceType: "companies_house",
        sourceUrl:
          "https://find-and-update.company-information.service.gov.uk/company/12345678",
        claimSummary: "Active limited company since 2014.",
        verifiedAt: "2026-08-15T05:20:00.000Z",
      },
    ],
    ...overrides,
  };
}

function baseVisualData(
  overrides: Partial<VisualConceptData> = {},
): VisualConceptData {
  return {
    prospectId: "22222222-2222-4222-8222-222222222222",
    businessName: "Smith & Sons Plumbing Ltd",
    sector: "Plumbing",
    locality: "Leeds",
    fitScore: 91,
    recommendedOffer: "Website + AI Enquiry Agent",
    estimatedOneOffMinPence: 300_000,
    estimatedOneOffMaxPence: 600_000,
    status: "draft",
    reviewedAt: null,
    heroConcept: section("Hero"),
    mobileFallback: section("Mobile"),
    performanceBudget: section("Performance"),
    asset: {
      url: "https://blob.example.public.blob.vercel-storage.com/growth-visual-assets/asset.webp",
      width: 1200,
      height: 630,
      byteSize: 120_000,
      altText: "Concept showing a booking flow hero image.",
      sha256: "a".repeat(64),
      reviewStatus: "approved",
      createdBy: "agent",
      createdAt: "2026-08-15T06:00:00.000Z",
    },
    ...overrides,
  };
}

test("StrategyReview renders every section's summary, evidence, and observations with proof", () => {
  const html = renderToStaticMarkup(
    <StrategyReview data={baseStrategyData()} />,
  );

  assert.match(html, /Convert emergency call-outs into booked jobs\./);
  assert.match(html, /Request a call-back/);
  for (const label of [
    "Conversion",
    "Sitemap",
    "Homepage",
    "Trust",
    "Local SEO",
    "Technology",
    "Future",
  ]) {
    assert.match(html, new RegExp(`${label} summary sentence\\.`));
    assert.match(html, new RegExp(`${label} observation one`));
    assert.match(html, new RegExp(`${label} observation two`));
  }
  assert.match(html, /Active limited company since 2014\./);
  assert.match(html, /drawn from the sources listed here/);
});

test("StrategyReview labels the future opportunities and overall brief as a proposal, not a commitment", () => {
  const html = renderToStaticMarkup(
    <StrategyReview data={baseStrategyData()} />,
  );

  assert.match(html, /Agent-drafted proposal/);
  assert.match(html, /proposed scope for founder review/);
  assert.match(html, /not a commitment made to/);
});

test("StrategyReview shows an empty state when no evidence is on file", () => {
  const html = renderToStaticMarkup(
    <StrategyReview data={baseStrategyData({ evidence: [] })} />,
  );
  assert.match(html, /No verified evidence is on file for this prospect\./);
});

test("StrategyReview shows the reviewed date once a founder has reviewed the brief", () => {
  const html = renderToStaticMarkup(
    <StrategyReview
      data={baseStrategyData({
        status: "reviewed",
        reviewedAt: "2026-08-16T09:00:00.000Z",
      })}
    />,
  );
  assert.match(html, /Reviewed/);
  assert.match(html, />Reviewed<\/span>/);
});

test("VisualConcept renders the generated image with alt text, checksum, dimensions, and a concept disclaimer", () => {
  const html = renderToStaticMarkup(<VisualConcept data={baseVisualData()} />);

  assert.match(
    html,
    /<img[^>]+alt="Concept showing a booking flow hero image\."/,
  );
  assert.match(html, /1200×630px/);
  assert.match(html, new RegExp("a".repeat(64)));
  assert.match(html, /117 KB/);
  assert.match(html, />Approved<\/span>/);
  assert.match(html, /Generated concept, not a built product/);
  assert.match(
    html,
    /No 3D renderer or working website was used to produce it\./,
  );
});

test("VisualConcept renders the 3 visual sections' summaries and observations", () => {
  const html = renderToStaticMarkup(<VisualConcept data={baseVisualData()} />);

  for (const label of ["Hero", "Mobile", "Performance"]) {
    assert.match(html, new RegExp(`${label} summary sentence\\.`));
    assert.match(html, new RegExp(`${label} observation one`));
  }
});

test("VisualConcept shows an empty state when no visual has been generated yet", () => {
  const html = renderToStaticMarkup(
    <VisualConcept data={baseVisualData({ asset: null })} />,
  );

  assert.match(
    html,
    /No visual concept has been generated for this prospect yet\./,
  );
  assert.doesNotMatch(html, /<img/);
});
