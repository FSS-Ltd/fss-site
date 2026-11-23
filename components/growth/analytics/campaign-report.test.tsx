import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildCampaignReport } from "@/lib/growth/campaigns/report";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { CampaignReports } =
  require("./campaign-report") as typeof import("./campaign-report");

test("renders scheduled and snapshot evidence without inventing a winner or conversion rate", () => {
  const anchor = new Date("2026-01-31T11:00:00Z"),
    cutoff = new Date("2026-02-28T11:00:00Z");
  const report = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff,
    members: [],
  });
  const html = renderToStaticMarkup(
    <CampaignReports
      result={{
        status: "ready",
        truncated: false,
        campaigns: [
          {
            id: "a",
            name: "Campaign",
            job: {
              status: "held",
              dueAt: cutoff.toISOString(),
              reason: "report_evidence_unknown",
            },
            truncated: false,
            snapshots: [
              {
                status: "available",
                revision: 1,
                current: false,
                generatedAt: cutoff.toISOString(),
                report,
                observedCoverage: 0,
              },
            ],
          },
        ],
      }}
    />,
  );
  assert.match(html, /Superseded snapshot/);
  assert.match(html, /Held/);
  assert.match(html, /report evidence unknown/);
  assert.match(html, /Gmail SENT confirmation observed by FSS/);
  assert.match(html, /comparison evidence is unknown/);
  assert.match(html, /Offer terms are unavailable/);
  assert.doesNotMatch(html, /conversion rate/i);
});

test("distinguishes a missing anchor and failed read", () => {
  const empty = renderToStaticMarkup(
    <CampaignReports
      result={{
        status: "ready",
        truncated: false,
        campaigns: [
          {
            id: "x",
            name: "X",
            job: { status: "no_anchor" },
            snapshots: [],
            truncated: false,
          },
        ],
      }}
    />,
  );
  assert.match(empty, /No report anchor recorded/);
  const error = renderToStaticMarkup(
    <CampaignReports result={{ status: "unavailable" }} />,
  );
  assert.match(error, /role="alert"/);
});
