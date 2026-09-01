import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert.match(prompt, /seo-audits\/claim/i);
    assert.match(prompt, /never request or use a database credential/i);
    assert.match(prompt, /do not create the PDF locally/i);
    assert.match(prompt, /never print a business name/i);
    assert.match(prompt, /create a Gmail draft, send email, queue an email/i);
    const schemaPath = input.args[input.args.indexOf("--output-schema") + 1];
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
      additionalProperties?: boolean;
    };
    assert.equal(schema.additionalProperties, false);
    return report;
  };

  const result = executeScheduledSeoAuditAgent({
    now: new Date("2026-09-01T05:30:00.000Z"),
    repositoryRoot: process.cwd(),
    executor,
  });

  assert.equal(result.succeeded, true);
  assert.deepEqual(result.report, report);
});
