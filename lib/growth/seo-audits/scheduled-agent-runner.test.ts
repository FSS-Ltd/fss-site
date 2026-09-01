import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildDailySeoAuditExternalRunId,
  executeScheduledSeoAuditAgent,
  type RedactedSeoAuditRunReport,
  type SeoAuditAgentExecutor,
} from "./scheduled-agent-runner";

const report: RedactedSeoAuditRunReport = {
  runDate: "2026-09-01",
  externalRunId: "seo-audit-2026-09-01-0630-europe-london-v1",
  promptVersion: "daily-seo-audit-v1",
  finalOutcome: "submitted",
  claimed: 2,
  submitted: 2,
  failed: 0,
  failureClass: null,
};

const auditIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
] as const;

function candidateClaimer() {
  return {
    candidateJson: JSON.stringify({
      ok: true,
      candidates: auditIds.map((auditId) => ({ auditId })),
    }),
    auditIds,
  };
}

test("builds a stable daily SEO audit run ID in the London timezone", () => {
  assert.equal(
    buildDailySeoAuditExternalRunId(new Date("2026-08-31T23:45:00.000Z")),
    "seo-audit-2026-09-01-0630-europe-london-v1",
  );
});

test("starts an isolated, schema-constrained agent that cannot send email", () => {
  const executor: SeoAuditAgentExecutor = (input) => {
    assert.equal(input.command, "codex");
    assert.ok(input.args.includes("--ephemeral"));
    assert.ok(input.args.includes("--output-schema"));
    const prompt = input.args.at(-1) ?? "";
    assert.match(prompt, /https:\/\/faithfulsoftware\.dev/);
    assert.match(prompt, /trusted scheduler wrapper owns candidate claims/i);
    assert.match(prompt, /do not access the Keychain/i);
    assert.match(prompt, /never request or use a database credential/i);
    assert.match(prompt, /do not create the PDF locally/i);
    assert.match(prompt, /never print a business name/i);
    assert.match(prompt, /create a Gmail draft, send email, queue an email/i);
    const schemaPath = input.args[input.args.indexOf("--output-schema") + 1];
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      additionalProperties?: boolean;
    };
    assert.equal(schema.additionalProperties, false);
    assert.match(input.claimLedgerPath, /claimed-audit-ids\.json$/);
    assert.match(input.candidatePath, /candidates\.json$/);
    assert.match(input.submissionDirectory, /submissions$/);
    for (const auditId of auditIds) {
      writeFileSync(join(input.submissionDirectory, `${auditId}.json`), "{}");
    }
    return report;
  };

  const submittedPaths: string[] = [];
  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    executor,
    candidateClaimer,
    submissionRunner: ({ submissionPath }) => {
      submittedPaths.push(submissionPath);
      return true;
    },
  });

  assert.equal(result.succeeded, true);
  assert.deepEqual(result.report, report);
  assert.equal(submittedPaths.length, 2);
});

test("releases claimed audits when the isolated agent does not complete", () => {
  let releasedPath: string | null = null;
  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    executor: () => ({
      ...report,
      finalOutcome: "failed",
      submitted: 0,
      failed: 2,
    }),
    candidateClaimer,
    claimReleaser: ({ claimLedgerPath }) => {
      releasedPath = claimLedgerPath;
    },
  });

  assert.equal(result.succeeded, false);
  assert.match(releasedPath ?? "", /claimed-audit-ids\.json$/);
});

test("releases only a missing or failed submission while preserving completed audits", () => {
  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    candidateClaimer,
    executor: (input) => {
      writeFileSync(
        join(input.submissionDirectory, `${auditIds[0]}.json`),
        "{}",
      );
      return { ...report, submitted: 1, failed: 1 };
    },
    submissionRunner: () => true,
    claimReleaser: () => {},
  });

  assert.equal(result.succeeded, false);
  assert.deepEqual(result.report, {
    ...report,
    submitted: 1,
    failed: 1,
    failureClass: "agent_failure",
  });
});

test("skips the isolated agent when the scheduler claims no audits", () => {
  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    candidateClaimer: () => ({
      candidateJson: '{"ok":true,"candidates":[]}',
      auditIds: [],
    }),
    executor: () => assert.fail("Agent should not run without candidates."),
  });

  assert.deepEqual(result.report, {
    ...report,
    finalOutcome: "no_candidates",
    claimed: 0,
    submitted: 0,
    failed: 0,
  });
});

test("documents the scheduler-owned signing boundary", () => {
  const runbook = readFileSync(
    "docs/growth-os/runbooks/scheduled-seo-audits.md",
    "utf8",
  );

  assert.match(runbook, /trusted scheduler wrapper, not the isolated agent/i);
  assert.match(runbook, /wrapper validates and submits the files/i);
  assert.match(
    runbook,
    /release only the remaining\s+claimed audits immediately/,
  );
  assert.match(runbook, /never reads the Keychain, signs a request/i);
});
