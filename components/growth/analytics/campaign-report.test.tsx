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
                version: 1,
                readAt: null,
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

test("V2 names the PostgreSQL read snapshot and keeps historical coverage unknown", () => {
  const anchor = new Date("2026-01-31T11:00:00Z");
  const cutoff = new Date("2026-02-28T11:00:00Z");
  const report = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff,
    evidenceAsOf: new Date("2026-03-01T12:00:00Z"),
    members: [],
  });
  const html = renderToStaticMarkup(
    <CampaignReports
      result={{
        status: "ready",
        truncated: false,
        campaigns: [
          {
            id: "c",
            name: "Campaign",
            job: {
              status: "completed",
              dueAt: cutoff.toISOString(),
              reason: null,
            },
            truncated: false,
            snapshots: [
              {
                status: "available",
                revision: 2,
                current: true,
                generatedAt: "2026-03-01T12:00:01.000Z",
                report,
                observedCoverage: 0,
                version: 2,
                readAt: "2026-03-01T12:00:00.000Z",
              },
            ],
          },
        ],
      }}
    />,
  );
  assert.match(html, /PostgreSQL statement snapshot read/);
  assert.match(
    html,
    /classifications and coverage reflect what was visible at that read/,
  );
  assert.match(
    html,
    /Historical source availability at cutoff and outcome source coverage are unknown/,
  );
  assert.doesNotMatch(html, /comparable copy identity: unknown/);
});

test("shows a V2 winner only when supplied by the validated snapshot reader", () => {
  const anchor = new Date("2026-01-31T11:00:00Z");
  const cutoff = new Date("2026-02-28T11:00:00Z");
  const base = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff,
    members: [],
  });
  const report = {
    ...base,
    winner: "a",
    winnerReason: "clear_interval" as const,
  };
  const html = renderToStaticMarkup(
    <CampaignReports
      result={{
        status: "ready",
        truncated: false,
        campaigns: [
          {
            id: "c",
            name: "Campaign",
            job: {
              status: "completed",
              dueAt: cutoff.toISOString(),
              reason: null,
            },
            truncated: false,
            snapshots: [
              {
                status: "available",
                revision: 2,
                current: true,
                generatedAt: "2026-03-01T12:00:01.000Z",
                report,
                observedCoverage: 60,
                version: 2,
                readAt: "2026-03-01T12:00:00.000Z",
              },
            ],
          },
        ],
      }}
    />,
  );
  assert.match(html, /leading variant: a/);
  assert.match(html, /observed comparison/);
  assert.match(
    html,
    /Historical source availability at cutoff and outcome source coverage are unknown/,
  );
});

test("puts outcomes before methodology and distinguishes unknown from zero rates", () => {
  const anchor = new Date("2026-03-27T12:00:00Z");
  const cutoff = new Date("2026-04-27T11:00:00Z");
  const member = (id: string, replyCoverage: "complete" | "unknown") => ({
    membershipId: id,
    businessId: id,
    market: "GB",
    offer: "review",
    policyVersion: 1,
    variantId: id,
    variantVersion: 1,
    cta: id,
    comparisonFingerprint: "same",
    commercialTermsFingerprint: "terms",
    confirmation: {
      basis: "gmail_fss_sent_observed" as const,
      observedAt: anchor,
      possibleInvocationFrom: anchor,
    },
    replyCoverage,
    meetingObservation: "unknown" as const,
    paymentObservation: "unknown" as const,
    replies: [],
    outcomes: [],
  });
  const report = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff,
    members: [member("a", "complete"), member("b", "unknown")],
  });
  const html = renderToStaticMarkup(
    <CampaignReports
      result={{
        status: "ready",
        truncated: false,
        campaigns: [
          {
            id: "c",
            name: "Campaign",
            job: {
              status: "completed",
              dueAt: cutoff.toISOString(),
              reason: null,
            },
            truncated: false,
            snapshots: [
              {
                status: "available",
                revision: 1,
                current: true,
                generatedAt: cutoff.toISOString(),
                report,
                observedCoverage: 1,
                version: 1,
                readAt: null,
              },
            ],
          },
        ],
      }}
    />,
  );
  assert.ok(
    html.indexOf("Mature sample") <
      html.indexOf("Snapshot provenance and methodology"),
  );
  assert.match(html, /0\.0%/);
  assert.match(html, /Unknown/);
  assert.equal((html.match(/class="rateTrack"/g) ?? []).length, 1);
  assert.match(html, /Variant evidence and coverage/);
});
