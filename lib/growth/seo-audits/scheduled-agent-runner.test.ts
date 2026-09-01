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

function submissionFor(auditId: string): string {
  return JSON.stringify({
    auditId,
    audit: {
      executiveSummary:
        "The public site has a sound starting point, but several visible gaps make it harder for local prospects and answer engines to understand the service, location, and next action without extra work.",
      scores: {
        technicalSeo: 62,
        onPageSeo: 58,
        localSeo: 48,
        answerEngineReadiness: 44,
      },
      strengths: [
        "The home page clearly states the primary service and includes a direct contact path.",
      ],
      findings: Array.from({ length: 4 }, (_, index) => ({
        id: `finding-${index + 1}`,
        severity: "medium",
        title: `Clearer service information needed ${index + 1}`,
        evidence:
          "The public page does not present a concise question-and-answer explanation for this service, which leaves essential information hard to scan.",
        whyItMatters:
          "Search engines and prospective customers need direct, consistent explanations before they can match this page to a specific local need.",
        actions: [
          {
            title: "Add a clear answer",
            instructions:
              "Add a short answer near the relevant service heading explaining who the service is for, what is included, and how a customer can get started.",
          },
        ],
      })),
      answerEngineSummary:
        "Add concise service, audience, location, and process answers in plain language so answer engines can reliably extract accurate responses from the site.",
      sources: [
        {
          title: "Public website",
          url: "https://example.com/",
          checkedAt: "2026-09-01T05:30:00.000Z",
        },
      ],
    },
    email: {
      subject: "A practical SEO and AEO audit for your website",
      paragraphs: [
        "I reviewed your public website and prepared a practical audit focused on the changes that can help customers and search engines understand your services more clearly. It covers technical foundations, page content, local visibility, and answer-engine readiness using only publicly available information.",
        "The report prioritises actions your team can complete without a developer, with plain instructions for each. I have also separated the quick wins from the items that need more care, so you can decide what to tackle first without changing your current website platform.",
      ],
    },
  });
}

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
    assert.match(prompt, /exactly conforms to seoAuditSubmissionSchema/i);
    assert.match(prompt, /80 to 160 words/i);
    const schemaPath = input.args[input.args.indexOf("--output-schema") + 1];
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      additionalProperties?: boolean;
    };
    assert.equal(schema.additionalProperties, false);
    assert.match(input.claimLedgerPath, /claimed-audit-ids\.json$/);
    assert.match(input.candidatePath, /candidates\.json$/);
    assert.match(input.submissionDirectory, /submissions$/);
    for (const auditId of auditIds) {
      writeFileSync(
        join(input.submissionDirectory, `${auditId}.json`),
        submissionFor(auditId),
      );
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
      return { status: "submitted" };
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
        submissionFor(auditIds[0]),
      );
      return { ...report, submitted: 1, failed: 1 };
    },
    submissionRunner: () => ({ status: "submitted" }),
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

test("does not submit malformed agent output and releases its claim", () => {
  let attempts = 0;
  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    candidateClaimer,
    executor: (input) => {
      writeFileSync(
        join(input.submissionDirectory, `${auditIds[0]}.json`),
        "{}",
      );
      writeFileSync(
        join(input.submissionDirectory, `${auditIds[1]}.json`),
        submissionFor(auditIds[1]),
      );
      return report;
    },
    submissionRunner: () => {
      attempts += 1;
      return { status: "submitted" };
    },
    claimReleaser: () => {},
  });

  assert.equal(attempts, 1);
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
