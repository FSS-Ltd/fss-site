import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { summary } from "@/lib/growth/dashboard/campaign-daily-summary.fixture";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { CampaignDailySummary } =
  require("./campaign-daily-summary") as typeof import("./campaign-daily-summary");
test("labels retained day and observation, distinctions and conditional goal", () => {
  const html = renderToStaticMarkup(
    <CampaignDailySummary result={{ status: "ready", summary }} />,
  );
  for (const text of [
    /21 Nov 2026/,
    /17:30/,
    /not a completed-day total/,
    /Proof-accepted/,
    /Confirmed within this London day/,
    /earlier day/,
    /day uncertain/,
    /permission 1/,
    /conditional on eligible recipients/,
  ])
    assert.match(html, text);
});
test("separates missing and unavailable summaries", () => {
  assert.match(
    renderToStaticMarkup(<CampaignDailySummary result={{ status: "empty" }} />),
    /No daily summary has been recorded/,
  );
  assert.match(
    renderToStaticMarkup(
      <CampaignDailySummary result={{ status: "unavailable" }} />,
    ),
    /unavailable/,
  );
});
