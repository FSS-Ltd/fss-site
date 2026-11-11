import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { AnalyticsPage, formatAnalyticsMonthLabel } =
  require("./analytics-page") as typeof import("./analytics-page");

function readyState() {
  return {
    status: "ready" as const,
    data: {
      month: "2026-08",
      range: { startDate: "2026-08-01", endDate: "2026-08-31" },
      funnel: {
        researchedProspects: 12,
        approvedFirstEmails: 10,
        replies: 4,
        qualifiedOpportunities: 3,
        proposals: 2,
        wins: 1,
      },
      values: {
        openPipelineValuePence: 900_000,
        agreedWonValuePence: 500_000,
        completedDeliveryValuePence: 300_000,
      },
      rates: {
        meetingsCount: 3,
        replyRate: 0.4 as number | null,
        meetingRate: 0.75 as number | null,
        proposalRate: (2 / 3) as number | null,
        winRate: 0.5 as number | null,
      },
    },
  };
}

test("formatAnalyticsMonthLabel renders a human month and year", () => {
  assert.equal(formatAnalyticsMonthLabel("2026-08"), "August 2026");
  assert.equal(formatAnalyticsMonthLabel("2026-01"), "January 2026");
});

test("renders the funnel, revenue, and conversion sections for a ready state", () => {
  const html = renderToStaticMarkup(
    <AnalyticsPage month="2026-08" state={readyState()} />,
  );
  assert.match(html, />Funnel<\/h2>/);
  assert.match(html, />Pipeline and delivery value<\/h2>/);
  assert.match(html, />Conversion<\/h2>/);
  assert.match(html, /Researched prospects/);
  assert.match(html, /£9,000/);
  assert.match(html, /August 2026/);
});

test("renders month navigation links pointing at the adjacent months", () => {
  const html = renderToStaticMarkup(
    <AnalyticsPage month="2026-08" state={readyState()} />,
  );
  assert.match(html, /href="\/growth\/analytics\?month=2026-07"/);
  assert.match(html, /href="\/growth\/analytics\?month=2026-09"/);
});

test("renders \"Not enough data\" instead of 0% for a null rate", () => {
  const state = readyState();
  state.data.rates.winRate = null;
  const html = renderToStaticMarkup(<AnalyticsPage month="2026-08" state={state} />);
  assert.match(html, /Not enough data/);
});

test("renders the error state with a correlation reference", () => {
  const html = renderToStaticMarkup(
    <AnalyticsPage
      month="2026-08"
      state={{
        status: "error",
        message: "The analytics for this month could not load.",
        correlationId: "corr-123",
      }}
    />,
  );
  assert.match(html, /could not load/);
  assert.match(html, /corr-123/);
  assert.doesNotMatch(html, />Funnel<\/h2>/);
});
