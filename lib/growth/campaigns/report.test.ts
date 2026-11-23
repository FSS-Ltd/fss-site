import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignReport } from "./report";
import type { CampaignReportInput } from "./schemas";

const anchor = new Date("2026-03-27T12:00:00Z");
const member = (
  id: string,
  variantId = "a",
): CampaignReportInput["members"][number] => ({
  membershipId: id,
  businessId: id,
  market: "GB",
  offer: "review",
  policyVersion: 1,
  variantId,
  variantVersion: 1,
  cta: variantId,
  comparisonFingerprint: "same",
  commercialTermsFingerprint: "terms",
  confirmation: {
    basis: "gmail_fss_sent_observed",
    observedAt: anchor,
    possibleInvocationFrom: new Date("2026-03-27T11:59:00Z"),
  },
  replyCoverage: "complete",
  meetingObservation: "unknown",
  paymentObservation: "unknown",
  replies: [],
  outcomes: [],
});
const input = (
  members: CampaignReportInput["members"],
): CampaignReportInput => ({
  anchor: { basis: "gmail_fss_sent_observed", observedAt: anchor },
  cutoff: new Date("2026-04-27T11:00:00Z"),
  members,
});

test("uses observation basis, preserves pre-anchor positive facts and keeps missing coverage out of rate", () => {
  const m = member("1");
  m.replyCoverage = "unknown";
  m.replies = [
    {
      id: "r",
      kind: "positive",
      reviewed: true,
      occurredAt: new Date("2026-03-27T11:59:30Z"),
      recordedAt: new Date("2026-03-28"),
    },
  ];
  const report = buildCampaignReport(input([m]));
  assert.equal(report.groups[0].knownPositiveReplies, 1);
  assert.equal(report.groups[0].preAnchorPositiveReplies, 1);
  assert.equal(report.groups[0].missingReplies, 1);
  assert.equal(report.groups[0].positiveReplyRate, null);
  assert.equal(report.anchor.basis, "gmail_fss_sent_observed");
});

test("conflicting attribution never depends on input order", () => {
  const a = member("a"),
    b = member("b", "b");
  const reply = {
    id: "shared",
    kind: "positive" as const,
    reviewed: true,
    occurredAt: new Date("2026-03-28"),
    recordedAt: new Date("2026-03-29"),
  };
  a.replies = [reply];
  b.replies = [reply];
  const result = buildCampaignReport(input([a, b]));
  assert.equal(result.ambiguousEvidence, 1);
  assert.equal(
    result.groups.reduce((sum, group) => sum + group.mature, 0),
    0,
  );
  assert.equal(result.winner, null);
  assert.deepEqual(buildCampaignReport(input([b, a])).groups, result.groups);
});

test("only compares matched, complete mature arms with distinct CTAs", () => {
  const members = Array.from({ length: 60 }, (_, i) => {
    const m = member(String(i), i < 30 ? "a" : "b");
    if (i < 30)
      m.replies = [
        {
          id: `r${i}`,
          kind: "positive",
          reviewed: true,
          occurredAt: new Date("2026-03-28"),
          recordedAt: new Date("2026-03-29"),
        },
      ];
    return m;
  });
  assert.equal(buildCampaignReport(input(members)).winner, "a");
  members[30].commercialTermsFingerprint = "different";
  assert.equal(buildCampaignReport(input(members)).winnerReason, "confounded");
});

test("counts later, censored and observed outcomes separately", () => {
  const a = member("a");
  a.outcomes = [
    {
      membershipId: "a",
      outcomeId: "meeting",
      kind: "meeting",
      reviewed: true,
      evidenceId: "meeting-source",
      occurredAt: new Date("2026-03-28"),
      recordedAt: new Date("2026-03-29"),
      netClearedPence: null,
    },
  ];
  const later = member("later");
  later.confirmation.observedAt = new Date("2026-04-10T11:00:00Z");
  const group = buildCampaignReport(input([a, later])).groups[0];
  assert.equal(group.qualifiedMeetings, 1);
  assert.equal(group.meetingUnknown, 1);
  assert.equal(group.later, 1);
});

test("keeps unattributed positive evidence visible when origin is unknown", () => {
  const m = member("unknown");
  m.confirmation.possibleInvocationFrom = null;
  m.replies = [
    {
      id: "r",
      kind: "positive",
      reviewed: true,
      occurredAt: new Date("2026-03-28"),
      recordedAt: new Date("2026-03-29"),
    },
  ];
  const group = buildCampaignReport(input([m])).groups[0];
  assert.equal(group.unknownOriginPositiveReplies, 1);
  assert.equal(group.missingReplies, 1);
  assert.equal(group.mature, 0);
});

test("uses London calendar boundaries and includes a reply at the exact maturity instant", () => {
  const m = member("boundary");
  const end = new Date("2026-04-10T11:00:00Z");
  m.replies = [
    {
      id: "at-end",
      kind: "positive",
      reviewed: true,
      occurredAt: end,
      recordedAt: end,
    },
  ];
  const ready = buildCampaignReport({ ...input([m]), cutoff: end }).groups[0];
  assert.equal(ready.mature, 1);
  assert.equal(ready.positiveReplies, 1);
  const early = buildCampaignReport({
    ...input([m]),
    cutoff: new Date(end.getTime() - 1),
  }).groups[0];
  assert.equal(early.censored, 1);
  assert.equal(early.knownPositiveReplies, 0);
});

test("holds cross-member outcome source attribution and retains other known outcomes", () => {
  const a = member("a"),
    b = member("b", "b");
  const shared = {
    kind: "payment" as const,
    reviewed: true,
    evidenceId: "invoice",
    occurredAt: new Date("2026-03-28"),
    recordedAt: new Date("2026-03-29"),
    netClearedPence: 100,
  };
  a.outcomes = [{ ...shared, membershipId: "a", outcomeId: "payment-a" }];
  b.outcomes = [{ ...shared, membershipId: "b", outcomeId: "payment-b" }];
  const report = buildCampaignReport(input([a, b]));
  assert.equal(
    report.groups.reduce((sum, group) => sum + group.paidConversions, 0),
    0,
  );
  assert.equal(report.winnerReason, "unknown");
});

test("identical duplicate rows are idempotent and changed duplicates hold", () => {
  const m = member("a");
  assert.equal(buildCampaignReport(input([m, m])).groups[0].mature, 1);
  const report = buildCampaignReport(input([m, { ...m, offer: "changed" }]));
  assert.equal(report.ambiguousEvidence, 1);
  assert.equal(report.winner, null);
  assert.equal(report.groups.length, 0);
});

test("excludes evidence recorded after the report cutoff", () => {
  const m = member("late-review");
  m.replies = [
    {
      id: "late",
      kind: "positive",
      reviewed: true,
      occurredAt: new Date("2026-03-28"),
      recordedAt: new Date("2026-05-01"),
    },
  ];
  const group = buildCampaignReport(input([m])).groups[0];
  assert.equal(group.positiveReplies, 0);
  assert.equal(group.knownPositiveReplies, 0);
  assert.equal(group.missingReplies, 1);
  assert.equal(group.mature, 0);
});

test("holds a comparison if the anchor is absent or a prior observation exists", () => {
  const m = member("one");
  m.confirmation.observedAt = new Date("2026-03-28");
  assert.equal(buildCampaignReport(input([m])).winnerReason, "unknown");
  m.confirmation.observedAt = new Date("2026-03-26");
  assert.equal(buildCampaignReport(input([m])).winnerReason, "unknown");
});

test("marks outcome coverage unknown when evidence arrived after cutoff", () => {
  const m = member("late-outcome");
  m.meetingObservation = "complete";
  m.outcomes = [
    {
      membershipId: m.membershipId,
      outcomeId: "meeting",
      kind: "meeting",
      reviewed: true,
      evidenceId: "meeting-evidence",
      occurredAt: new Date("2026-03-28"),
      recordedAt: new Date("2026-05-01"),
      netClearedPence: null,
    },
  ];
  const group = buildCampaignReport(input([m])).groups[0];
  assert.equal(group.qualifiedMeetings, 0);
  assert.equal(group.meetingMature, 0);
  assert.equal(group.meetingUnknown, 1);
});

test("generation-visible reviews are distinct from the scheduled event cutoff", () => {
  const m = member("late");
  m.replies = [
    {
      id: "late-review",
      kind: "positive",
      reviewed: true,
      occurredAt: new Date("2026-03-28"),
      recordedAt: new Date("2026-05-01"),
    },
  ];
  const historical = input([m]);
  assert.equal(
    buildCampaignReport(historical).groups[0].knownPositiveReplies,
    0,
  );
  assert.equal(
    buildCampaignReport({ ...historical, evidenceAsOf: new Date("2026-05-02") })
      .groups[0].knownPositiveReplies,
    1,
  );
  assert.throws(
    () =>
      buildCampaignReport({
        ...historical,
        evidenceAsOf: new Date("2026-04-01"),
      }),
    /invalid_report_cutoff/,
  );
});

test("never compares provider bases or selects a sparse arm", () => {
  const two = Array.from({ length: 60 }, (_, i) => {
    const m = member(String(i), i < 30 ? "a" : "b");
    if (i >= 30) m.confirmation.basis = "resend_fss_delivery_observed";
    if (i < 30)
      m.replies = [
        {
          id: `r-${i}`,
          kind: "positive",
          reviewed: true,
          occurredAt: new Date("2026-03-28"),
          recordedAt: new Date("2026-03-29"),
        },
      ];
    return m;
  });
  assert.equal(buildCampaignReport(input(two)).winnerReason, "confounded");
  assert.equal(buildCampaignReport(input(two)).winner, null);
  const sparse = two.slice(0, 58).map((m) => ({
    ...m,
    confirmation: {
      ...m.confirmation,
      basis: "gmail_fss_sent_observed" as const,
    },
  }));
  assert.equal(
    buildCampaignReport(input(sparse)).winnerReason,
    "insufficient_evidence",
  );
  assert.equal(buildCampaignReport(input(sparse)).winner, null);
});
