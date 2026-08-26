import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ResearchAgentOutputError,
  parseRedactedResearchReport,
  runRedactedChildProcess,
} from "./redacted-run-report";

const validReport = {
  runDate: "2026-08-26",
  mode: "submit",
  externalRunId: "weekday-2026-08-26-0600-europe-london-v1",
  promptVersion: "weekday-research-v1",
  finalOutcome: "submitted",
  httpStatus: 200,
  correlationId: "3b2e3d83-e2f6-41fb-a774-2323409ef82d",
  accepted: 5,
  duplicate: 0,
  rejected: 4,
  rejectionReasonTotals: {
    outside_kent: 0,
    ineligible_corporate_type: 0,
    inactive_company: 0,
    personal_subscriber: 0,
    uncertain_partnership: 0,
    unverifiable_work_email: 3,
    unsupported_claim: 0,
    insufficient_opportunity_evidence: 1,
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
} as const;

test("parses the complete redacted research report contract", () => {
  assert.deepEqual(
    parseRedactedResearchReport(JSON.stringify(validReport)),
    validReport,
  );
});

test("rejects a report containing prospect or contact fields", () => {
  const unsafeReport = {
    ...validReport,
    email: "private@example.test",
  };

  assert.throws(
    () => parseRedactedResearchReport(JSON.stringify(unsafeReport)),
    ResearchAgentOutputError,
  );
});

test("requires an explicit total for every controlled rejection reason", () => {
  const incompleteReport = {
    ...validReport,
    rejectionReasonTotals: { unverifiable_work_email: 4 },
  };

  assert.throws(
    () => parseRedactedResearchReport(JSON.stringify(incompleteReport)),
    ResearchAgentOutputError,
  );
});

test("rejects a reason breakdown that does not equal the rejected total", () => {
  const inconsistentReport = {
    ...validReport,
    rejected: 5,
  };

  assert.throws(
    () => parseRedactedResearchReport(JSON.stringify(inconsistentReport)),
    ResearchAgentOutputError,
  );
});

test("discards child output and returns only the validated report file", () => {
  const directory = mkdtempSync(join(tmpdir(), "fss-redacted-run-test-"));
  const fixturePath = join(directory, "child.mjs");
  const reportPath = join(directory, "report.json");
  const privateValue = "private-contact@example.test";

  try {
    writeFileSync(
      fixturePath,
      [
        'import { writeFileSync } from "node:fs";',
        `process.stdout.write(${JSON.stringify(privateValue)});`,
        `process.stderr.write(${JSON.stringify(privateValue)});`,
        `writeFileSync(process.argv[2], ${JSON.stringify(JSON.stringify(validReport))});`,
      ].join("\n"),
      { mode: 0o600 },
    );

    const report = runRedactedChildProcess({
      command: process.execPath,
      args: [fixturePath, reportPath],
      cwd: directory,
      reportPath,
      timeoutMs: 10_000,
    });

    assert.deepEqual(report, validReport);
    assert.equal(JSON.stringify(report).includes(privateValue), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("returns a generic error when the child report is unsafe", () => {
  const directory = mkdtempSync(join(tmpdir(), "fss-redacted-run-test-"));
  const fixturePath = join(directory, "child.mjs");
  const reportPath = join(directory, "report.json");
  const privateValue = "private-contact@example.test";

  try {
    writeFileSync(
      fixturePath,
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(process.argv[2], JSON.stringify({ email: ${JSON.stringify(privateValue)} }));`,
      ].join("\n"),
      { mode: 0o600 },
    );

    assert.throws(
      () =>
        runRedactedChildProcess({
          command: process.execPath,
          args: [fixturePath, reportPath],
          cwd: directory,
          reportPath,
          timeoutMs: 10_000,
        }),
      (error: unknown) => {
        assert.ok(error instanceof ResearchAgentOutputError);
        assert.equal(error.message, "Research agent output was not safe.");
        assert.equal(error.message.includes(privateValue), false);
        return true;
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
