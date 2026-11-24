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
    jobHasSubMillisecond: false,
    jobReceiptMatches: true,
    jobMembershipMatches: true,
    jobPolicyVersion: 1,
    reportId: `snapshot-${revision}`,
    reportPolicyVersion: 1,
    reportAnchorId: "anchor",
    reportRevision: revision,
    reportCutoff: due,
    generatedAt: new Date("2026-03-01T12:00:00Z"),
    reportAnchorAt: anchor,
    reportBasis: "gmail_fss_sent_observed",
    reportHasSubMillisecond: false,
    reportReceiptMatches: true,
    reportMembershipMatches: true,
    reportWitnessIncluded: true,
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

test("V2 accepts a supported winner while preserving read-snapshot timing", async () => {
  const current = row();
  const anchor = current.jobAnchorAt;
  const cutoff = current.jobDue;
  const readAt = new Date("2026-03-01T12:00:00Z");
  const members = Array.from({ length: 60 }, (_, index) => ({
    membershipId: `m-${index}`,
    businessId: `b-${index}`,
    market: "GB",
    offer: "review",
    policyVersion: 1,
    variantId: index < 30 ? "a" : "b",
    variantVersion: 1,
    cta: index < 30 ? "May I?" : "Could I?",
    comparisonFingerprint: "same-copy",
    commercialTermsFingerprint: "same-terms",
    confirmation: {
      basis: "gmail_fss_sent_observed" as const,
      observedAt: anchor,
      possibleInvocationFrom: new Date(anchor.getTime() - 1000),
    },
    replyCoverage: "complete" as const,
    meetingObservation: "unknown" as const,
    paymentObservation: "unknown" as const,
    replies:
      index < 30
        ? [
            {
              id: `reply-${index}`,
              kind: "positive" as const,
              reviewed: true,
              occurredAt: new Date("2026-02-01T12:00:00Z"),
              recordedAt: readAt,
            },
          ]
        : [],
    outcomes: [],
  }));
  const report = buildCampaignReport({
    anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
    cutoff,
    evidenceAsOf: readAt,
    members,
  });
  assert.equal(report.winner, "a");
  current.generatedAt = new Date("2026-03-01T12:00:01Z");
  current.payload = JSON.parse(
    JSON.stringify({
      version: 2,
      visibility: {
        basis: "postgres_statement_snapshot",
        snapshot: "100:102:101",
        readAt,
      },
      sourceAvailabilityAtCutoff: "unknown",
      sourceAvailabilityReason: "commit_time_unavailable",
      outcomeSources: "unknown",
      comparisonCopyIdentity: "frozen_when_available",
      coverageCompleteObservedAtRead: 60,
      report,
    }),
  );
  const result = await getCampaignReports(founder, dbReturning([current]));
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  const snapshot = result.campaigns[0]?.snapshots[0];
  assert.equal(snapshot?.status, "available");
  if (snapshot?.status === "available") {
    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.report.winner, "a");
    assert.equal(snapshot.readAt, readAt.toISOString());
  }
  const forged = structuredClone(current);
  forged.payload.report.groups[0].comparisonFingerprint = "different";
  const invalid = await getCampaignReports(founder, dbReturning([forged]));
  if (invalid.status === "ready")
    assert.equal(invalid.campaigns[0]?.snapshots[0]?.status, "unavailable");
});

test("schedules using the exact provider witness and rejects missing or mismatched anchors", async () => {
  const resend = row();
  const anchor = new Date("2026-01-31T23:59:59.999Z");
  const due = new Date("2026-03-01T00:00:00.000Z");
  const report = buildCampaignReport({
    anchor: { basis: "resend_fss_delivery_observed", observedAt: anchor },
    cutoff: due,
    evidenceAsOf: new Date("2026-03-01T01:00:00Z"),
    members: [],
  });
  Object.assign(resend, {
    jobAnchorAt: anchor,
    jobBasis: "resend_fss_delivery_observed",
    jobHasSubMillisecond: true,
    jobDue: due,
    reportAnchorAt: anchor,
    reportBasis: "resend_fss_delivery_observed",
    reportHasSubMillisecond: true,
    reportCutoff: due,
    generatedAt: new Date("2026-03-01T01:00:01Z"),
    payload: {
      version: 2,
      visibility: {
        basis: "postgres_statement_snapshot",
        snapshot: "100:100:",
        readAt: "2026-03-01T01:00:00.000Z",
      },
      sourceAvailabilityAtCutoff: "unknown",
      sourceAvailabilityReason: "commit_time_unavailable",
      outcomeSources: "unknown",
      comparisonCopyIdentity: "frozen_when_available",
      coverageCompleteObservedAtRead: 0,
      report: JSON.parse(JSON.stringify(report)),
    },
  });
  const result = await getCampaignReports(founder, dbReturning([resend]));
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.campaigns[0]?.job.status, "completed");
    assert.equal(result.campaigns[0]?.snapshots[0]?.status, "available");
  }
  for (const patch of [
    { jobReceiptMatches: false },
    { reportReceiptMatches: false },
    { reportMembershipMatches: false },
    { reportWitnessIncluded: false },
    { reportHasSubMillisecond: false },
  ]) {
    const invalid = await getCampaignReports(
      founder,
      dbReturning([{ ...resend, ...patch }]),
    );
    if (invalid.status === "ready")
      assert.equal(invalid.campaigns[0]?.job.status, "unavailable");
  }
  const gmail = row();
  gmail.jobHasSubMillisecond = true;
  gmail.reportHasSubMillisecond = true;
  const unchanged = await getCampaignReports(founder, dbReturning([gmail]));
  if (unchanged.status === "ready")
    assert.equal(unchanged.campaigns[0]?.job.status, "completed");
});
