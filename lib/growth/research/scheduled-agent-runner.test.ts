import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import type { RedactedResearchReport } from "./redacted-run-report";
import {
  buildWeekdayExternalRunId,
  executeScheduledResearchAgent,
  type ResearchAgentExecutor,
} from "./scheduled-agent-runner";

const submittedReport: RedactedResearchReport = {
  runDate: "2026-08-26",
  mode: "submit",
  externalRunId: "weekday-2026-08-26-0600-europe-london-v1",
  promptVersion: "weekday-research-v1",
  finalOutcome: "submitted",
  httpStatus: 200,
  correlationId: null,
  accepted: 5,
  duplicate: 0,
  rejected: 4,
  rejectionReasonTotals: {
    outside_kent: 0,
    ineligible_corporate_type: 0,
    inactive_company: 0,
    personal_subscriber: 0,
    uncertain_partnership: 0,
    unverifiable_work_email: 4,
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

test("builds the stable weekday identifier from the London calendar date", () => {
  assert.equal(
    buildWeekdayExternalRunId(new Date("2026-08-25T23:30:00.000Z")),
    "weekday-2026-08-26-0600-europe-london-v1",
  );
});

test("runs the researcher in a disposable workspace with schema-constrained output", () => {
  let childWorkspace: string | null = null;

  const executor: ResearchAgentExecutor = (input) => {
    childWorkspace = input.cwd;
    assert.equal(input.command, "codex");
    assert.ok(input.args.includes("--ephemeral"));
    assert.ok(input.args.includes("--ignore-user-config"));
    assert.ok(input.args.includes("--ignore-rules"));
    assert.ok(input.args.includes("--output-schema"));
    assert.ok(input.args.includes("--output-last-message"));

    const prompt = input.args.at(-1) ?? "";
    assert.match(prompt, /first-party strength/i);
    assert.match(prompt, /two or three sourced website-journey improvements/i);
    assert.match(prompt, /private preview URL/i);
    assert.match(prompt, /never call.*prospect-preview-prs/i);
    assert.match(prompt, /version 1\.1 bundle/i);
    assert.match(prompt, /first-party preview evidence only/i);
    assert.match(prompt, /no AI image API/i);
    assert.match(prompt, /prospect-preview-assets/i);

    const schemaPath = input.args[input.args.indexOf("--output-schema") + 1];
    const reportPath =
      input.args[input.args.indexOf("--output-last-message") + 1];
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      additionalProperties?: boolean;
    };

    assert.equal(schema.additionalProperties, false);
    assert.equal(reportPath, input.reportPath);
    assert.equal(input.cwd.startsWith(process.cwd()), false);
    return submittedReport;
  };

  const result = executeScheduledResearchAgent({
    now: new Date("2026-08-26T05:00:00.000Z"),
    repositoryRoot: process.cwd(),
    executor,
  });

  assert.deepEqual(result.report, submittedReport);
  assert.equal(result.succeeded, true);
  assert.notEqual(childWorkspace, null);
  assert.equal(existsSync(childWorkspace!), false);
});

test("returns a redacted failure and removes the workspace when the child fails", () => {
  let childWorkspace: string | null = null;
  const privateValue = "private-contact@example.test";

  const executor: ResearchAgentExecutor = (input) => {
    childWorkspace = input.cwd;
    throw new Error(privateValue);
  };

  const result = executeScheduledResearchAgent({
    now: new Date("2026-08-26T05:00:00.000Z"),
    repositoryRoot: process.cwd(),
    executor,
  });

  assert.equal(result.succeeded, false);
  assert.equal(result.report.failureClass, "agent_failure");
  assert.equal(JSON.stringify(result).includes(privateValue), false);
  assert.notEqual(childWorkspace, null);
  assert.equal(existsSync(childWorkspace!), false);
});
