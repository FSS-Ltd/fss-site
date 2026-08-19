import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type {
  ProspectListQuery,
  ProspectListResult,
} from "@/lib/growth/dashboard/prospects";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { ProspectList } =
  require("./prospect-list") as typeof import("./prospect-list");

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
  prospectId: "prospect-1",
  businessName: "Smith & Sons Plumbing Ltd",
  websiteUrl: "https://smithandsonsplumbing.co.uk",
  sector: "Plumbing",
  location: "Maidstone",
  fitScore: 91,
  opportunitySummary: "No website, slow enquiry handling",
  recommendedOffer: "Website + AI Enquiry Agent",
  status: "ready_for_email_review" as const,
  outreachState: "not_started" as const,
  potentialValuePence: 650_000,
  nextAction: "Review email",
  nextActionDueAt: null,
};

const readyData: ProspectListResult = {
  rows: [sampleRow],
  totalCount: 128,
  nextCursor: "next-cursor-token",
  facets: { sectors: ["Plumbing", "Garage"], locations: ["Maidstone", "Ashford"] },
};

function renderList(
  state: ViewState<ProspectListResult>,
  query: ProspectListQuery = baseQuery(),
): string {
  return renderToStaticMarkup(<ProspectList query={query} state={state} />);
}

test("renders the ready state with a result count and business rows", () => {
  const html = renderList({ status: "ready", data: readyData });

  assert.match(html, /Showing 1 of 128 prospects/);
  assert.match(html, /Smith &amp; Sons Plumbing Ltd/);
  assert.match(html, /£6,500/);
});

test("labels every filter control so it can be operated by keyboard and screen reader", () => {
  const html = renderList({ status: "ready", data: readyData });

  assert.match(html, /<label[^>]*for="prospect-search"[^>]*>Search<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-sector"[^>]*>Sector<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-location"[^>]*>Location<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-fit-score"[^>]*>Fit score<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-status"[^>]*>Status<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-outreach"[^>]*>Outreach<\/label>/);
  assert.match(html, /<label[^>]*for="prospect-suppressed"[^>]*>Suppression<\/label>/);
  assert.match(html, /type="submit"[^>]*>Apply filters/);
});

test("submits filters through a plain GET form, not client-side fetch", () => {
  const html = renderList({ status: "ready", data: readyData });

  assert.match(html, /<form[^>]*method="GET"/);
});

test("shows a removable chip for every active filter and a clear-all link", () => {
  const html = renderList(
    { status: "ready", data: readyData },
    baseQuery({ sector: "Plumbing", status: "needs_review" }),
  );

  assert.match(html, /Sector: Plumbing/);
  assert.match(html, /Status: Needs review/);
  assert.match(html, /Clear filters/);
  assert.match(html, /href="\/growth\/prospects\?status=needs_review"/);
});

test("shows no filter chips when nothing is filtered", () => {
  const html = renderList({ status: "ready", data: readyData });
  assert.doesNotMatch(html, /Clear filters/);
});

test("renders an inline empty state without discarding the filter bar", () => {
  const html = renderList({
    status: "ready",
    data: { ...readyData, rows: [], totalCount: 0, nextCursor: null },
  });

  assert.match(html, /No prospects match these filters\./);
  assert.match(html, /<form/);
});

test("renders a safe error state with a correlation ID and no leaked detail", () => {
  const html = renderList({
    status: "error",
    message: "The prospect list could not load.",
    correlationId: "22222222-2222-2222-2222-222222222222",
  });

  assert.match(html, /The prospect list could not load\./);
  assert.match(html, /22222222-2222-2222-2222-222222222222/);
  assert.doesNotMatch(html, /select |postgres|ECONNREFUSED/i);
});

test("gives the results table an accessible caption and does not rely on colour alone for outreach state", () => {
  const html = renderList({ status: "ready", data: readyData });

  assert.match(html, /<caption[^>]*>Prospect list<\/caption>/);
  assert.match(html, /<th scope="col">Business<\/th>/);
  assert.match(html, />Not started<\/span>/);
});

test("only enables the next-page link when a cursor is available", () => {
  const withNext = renderList({ status: "ready", data: readyData });
  assert.match(withNext, /aria-disabled="false"[^>]*>\s*Next page/);

  const withoutNext = renderList({
    status: "ready",
    data: { ...readyData, nextCursor: null },
  });
  assert.match(withoutNext, /aria-disabled="true"[^>]*>\s*Next page/);
});

test("renders a mobile card list alongside the desktop table, toggled by CSS only", () => {
  const html = renderList({ status: "ready", data: readyData });

  assert.match(html, /<table[^>]*>/);
  assert.match(html, /class="[^"]*mobileList[^"]*"/);
});

test("hides the desktop table and shows prospect cards below the tablet breakpoint", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const css = readFileSync(
    new URL("./prospects.module.css", import.meta.url),
    "utf8",
  );

  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.table[\s\S]*?display: none/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*?\.mobileList[\s\S]*?display: flex/,
  );
});
