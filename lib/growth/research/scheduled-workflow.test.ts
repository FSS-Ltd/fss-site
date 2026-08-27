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

test("asks the trusted parent to create preview PRs only after a successful accepted research run", async () => {
  let secretReads = 0;
  const triggerRunIds: string[] = [];

  const result = await runScheduledResearchWorkflow({
    runResearch: () => ({ succeeded: true, report: successfulReport }),
    readAgentSecret: () => {
      secretReads += 1;
      return "a".repeat(32);
    },
    triggerPreviewPullRequest: async (input) => {
      triggerRunIds.push(input.externalRunId);
      assert.equal(input.secret, "a".repeat(32));
      return { ok: true };
    },
  });

  assert.deepEqual(result, { succeeded: true, report: successfulReport });
  assert.equal(secretReads, 1);
  assert.deepEqual(triggerRunIds, [successfulReport.externalRunId]);
});

test("does not read the signing secret or trigger a preview PR for an empty accepted set", async () => {
  let secretReads = 0;
  let triggers = 0;
  const report = { ...successfulReport, accepted: 0 };

  const result = await runScheduledResearchWorkflow({
    runResearch: () => ({ succeeded: true, report }),
    readAgentSecret: () => {
      secretReads += 1;
      return "a".repeat(32);
    },
    triggerPreviewPullRequest: async () => {
      triggers += 1;
      return { ok: true };
    },
  });

  assert.deepEqual(result, { succeeded: true, report });
  assert.equal(secretReads, 0);
  assert.equal(triggers, 0);
});

test("keeps the redacted report but fails the scheduler when preview PR creation fails", async () => {
  const result = await runScheduledResearchWorkflow({
    runResearch: () => ({ succeeded: true, report: successfulReport }),
    readAgentSecret: () => "a".repeat(32),
    triggerPreviewPullRequest: async () => ({ ok: false }),
  });

  assert.deepEqual(result, { succeeded: false, report: successfulReport });
});
