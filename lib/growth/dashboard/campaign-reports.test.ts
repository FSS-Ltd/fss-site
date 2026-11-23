import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthQueryExecutor } from "../db/types";
import { buildCampaignReport } from "../campaigns/report";
import { campaignMonthAnniversary } from "../campaigns/time";
import { getCampaignReports } from "./campaign-reports";

const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
const dbReturning = (rows: object[]) =>
  (async () => rows) as unknown as GrowthQueryExecutor;
function row(revision = 2) {
  const anchor = new Date("2026-01-31T11:00:00Z");
  const due = campaignMonthAnniversary(anchor);
  const report = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff: due,
    members: [
      {
        membershipId: "m",
        businessId: "b",
        market: "GB",
        offer: "review",
        policyVersion: 1,
        variantId: "a",
        variantVersion: 1,
        cta: "May I?",
        comparisonFingerprint: null,
        commercialTermsFingerprint: null,
        confirmation: {
          basis: "gmail_fss_sent_observed",
          observedAt: anchor,
          possibleInvocationFrom: null,
        },
        replyCoverage: "unknown",
        meetingObservation: "unknown",
        paymentObservation: "unknown",
        replies: [],
        outcomes: [],
      },
    ],
  });
  const payload = JSON.parse(
    JSON.stringify({
      version: 1,
      sourceAvailabilityAtCutoff: "unknown",
      sourceAvailabilityReason: "commit_time_unavailable",
      outcomeSources: "unknown",
      comparisonCopyIdentity: "unknown",
      coverageCompleteObservedAtRead: 0,
      report,
    }),
  );
  return {
    id: "campaign",
    name: "Campaign",
    jobId: "job",
    jobStatus: "completed",
    jobDue: due,
    jobReason: null,
    jobAnchorId: "anchor",
    jobAnchorRevision: 2,
    jobAnchorAt: anchor,
    jobBasis: "gmail_fss_sent_observed",
    jobPolicyVersion: 1,
    reportId: `snapshot-${revision}`,
    reportPolicyVersion: 1,
    reportAnchorId: "anchor",
    reportRevision: revision,
    reportCutoff: due,
    generatedAt: new Date("2026-03-01T12:00:00Z"),
    reportAnchorAt: anchor,
    reportBasis: "gmail_fss_sent_observed",
    payload,
  };
}

test("projects persisted current and superseded reports without exposing source identities", async () => {
  const current = row();
  const prior = row(1);
  current.payload.sources = { replyIds: ["private-message"] };
  const result = await getCampaignReports(
    founder,
    dbReturning([current, prior]),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.campaigns[0]?.job.status, "completed");
  const [a, b] = result.campaigns[0]!.snapshots;
  assert.equal(a?.status, "available");
  assert.equal(a?.current, true);
  assert.equal(b?.current, false);
  assert.doesNotMatch(JSON.stringify(result), /private-message/);
  if (a?.status === "available") {
    assert.equal(a.report.groups[0]?.missingReplies, 1);
    assert.equal(a.report.groups[0]?.positiveReplyRate, null);
  }
});

test("does not claim a current report from invalid or mismatched facts", async () => {
  const current = row();
  current.payload.report.groups[0].mature = -1;
  const result = await getCampaignReports(founder, dbReturning([current]));
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.campaigns[0]?.job.status, "unavailable");
  assert.equal(result.campaigns[0]?.snapshots[0]?.status, "unavailable");
  const falseWinner = row();
  falseWinner.payload.report.winner = "a";
  falseWinner.payload.report.winnerReason = "clear_interval";
  const falseWinnerResult = await getCampaignReports(
    founder,
    dbReturning([falseWinner]),
  );
  assert.equal(falseWinnerResult.status, "ready");
  if (falseWinnerResult.status === "ready")
    assert.equal(
      falseWinnerResult.campaigns[0]?.snapshots[0]?.status,
      "unavailable",
    );
  const mismatched = row();
  mismatched.reportAnchorId = "different";
  const mismatchResult = await getCampaignReports(
    founder,
    dbReturning([mismatched]),
  );
  assert.equal(mismatchResult.status, "ready");
  if (mismatchResult.status === "ready")
    assert.equal(
      mismatchResult.campaigns[0]?.snapshots[0]?.status,
      "unavailable",
    );
});

test("shows no recorded anchor, bounds query to scheduled reports, and rejects non-founder access", async () => {
  let sql = "";
  const db = (async (strings: TemplateStringsArray) => {
    sql = strings.join(" ");
    return [{ ...row(), jobId: null, reportId: null, reportRevision: null }];
  }) as unknown as GrowthQueryExecutor;
  const result = await getCampaignReports(founder, db);
  assert.equal(result.status, "ready");
  if (result.status === "ready")
    assert.equal(result.campaigns[0]?.job.status, "no_anchor");
  assert.match(sql, /generation_kind='scheduled_report'/);
  assert.match(sql, /limit 4/);
  await assert.rejects(() =>
    getCampaignReports({ ...founder, actorId: "forged" }, db),
  );
});
