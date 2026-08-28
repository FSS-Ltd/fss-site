import assert from "node:assert/strict";
import test from "node:test";

import type { RedactedResearchReport } from "./redacted-run-report";
import { runScheduledResearchWorkflow } from "./scheduled-workflow";

const successfulReport: RedactedResearchReport = {
  runDate: "2026-08-27",
  mode: "submit",
  externalRunId: "weekday-2026-08-27-0600-europe-london-v1",
  promptVersion: "weekday-research-v1",
  finalOutcome: "submitted",
  httpStatus: 200,
  correlationId: null,
  accepted: 5,
  duplicate: 0,
  rejected: 0,
  rejectionReasonTotals: {
    outside_kent: 0,
    ineligible_corporate_type: 0,
    inactive_company: 0,
    personal_subscriber: 0,
    uncertain_partnership: 0,
    unverifiable_work_email: 0,
    unsupported_claim: 0,
    insufficient_opportunity_evidence: 0,
    known_duplicate: 0,
    suppressed_contact: 0,
  },
  targetOfTenMet: false,
  visuals: {
    generationAttempted: 0,
    uploaded: 0,
    failed: 0,
    fallbackRetained: 5,
  },
  attemptCount: 1,
  failureClass: null,
};

test("returns a successful accepted research run without invoking the retired generic preview generator", async () => {
  const result = await runScheduledResearchWorkflow({
    runResearch: () => ({ succeeded: true, report: successfulReport }),
  });

  assert.deepEqual(result, { succeeded: true, report: successfulReport });
});

test("returns an empty accepted set without creating a generic preview", async () => {
  const report = { ...successfulReport, accepted: 0 };

  const result = await runScheduledResearchWorkflow({
    runResearch: () => ({ succeeded: true, report }),
  });

  assert.deepEqual(result, { succeeded: true, report });
});
