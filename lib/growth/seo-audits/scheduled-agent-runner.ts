import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

const PROMPT_VERSION = "daily-seo-audit-v1";
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1_000;

export const redactedSeoAuditRunReportSchema = z
  .object({
    runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    externalRunId: z
      .string()
      .regex(/^seo-audit-\d{4}-\d{2}-\d{2}-0630-europe-london-v1$/),
    promptVersion: z.literal(PROMPT_VERSION),
    finalOutcome: z.enum(["submitted", "no_candidates", "failed"]),
    claimed: z.number().int().min(0).max(5),
    submitted: z.number().int().min(0).max(5),
    failed: z.number().int().min(0).max(5),
    failureClass: z.enum(["agent_failure", "submission_failure"]).nullable(),
  })
  .strict()
  .refine(
    (report) =>
      report.claimed === report.submitted + report.failed &&
      (report.finalOutcome === "submitted" ? report.submitted > 0 : true) &&
      (report.finalOutcome === "no_candidates" ? report.claimed === 0 : true),
    "Redacted SEO audit report totals are inconsistent.",
  );

export type RedactedSeoAuditRunReport = z.infer<
  typeof redactedSeoAuditRunReportSchema
>;

type SeoAuditAgentExecutionInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  reportPath: string;
  claimLedgerPath: string;
  timeoutMs: number;
};

export type SeoAuditAgentExecutor = (
  input: SeoAuditAgentExecutionInput,
) => RedactedSeoAuditRunReport;

function runRedactedSeoAuditChild(
  input: SeoAuditAgentExecutionInput,
): RedactedSeoAuditRunReport {
  const result = spawnSync(input.command, input.args, {
    cwd: input.cwd,
    stdio: ["ignore", "ignore", "ignore"],
    timeout: input.timeoutMs,
    env: {
      ...process.env,
      GROWTH_OS_SEO_AUDIT_CLAIM_LEDGER_PATH: input.claimLedgerPath,
    },
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("SEO audit agent did not complete successfully.");
  }
  return redactedSeoAuditRunReportSchema.parse(
    JSON.parse(readFileSync(input.reportPath, "utf8")) as unknown,
  );
}

export type SeoAuditClaimReleaser = (input: {
  repositoryRoot: string;
  claimLedgerPath: string;
}) => void;

function releaseIncompleteSeoAuditClaims(input: {
  repositoryRoot: string;
  claimLedgerPath: string;
}): void {
  spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/seo-audit-agent-api.ts",
      "release",
      input.claimLedgerPath,
    ],
    {
      cwd: input.repositoryRoot,
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 30_000,
    },
  );
}

type ExecuteScheduledSeoAuditAgentInput = {
  now?: Date;
  repositoryRoot: string;
  codexBinary?: string;
  timeoutMs?: number;
  executor?: SeoAuditAgentExecutor;
  claimReleaser?: SeoAuditClaimReleaser;
};

export type ScheduledSeoAuditAgentResult = {
  succeeded: boolean;
  report: RedactedSeoAuditRunReport;
};

function londonDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildDailySeoAuditExternalRunId(date: Date): string {
  return `seo-audit-${londonDate(date)}-0630-europe-london-v1`;
}

function buildAgentPrompt(
  repositoryRoot: string,
  externalRunId: string,
): string {
  const allowedFiles = [
    "docs/growth-os/prompts/daily-seo-audit.md",
    "docs/growth-os/runbooks/scheduled-seo-audits.md",
    "lib/growth/seo-audits/schema.ts",
    "lib/growth/seo-audits/local-agent-client.ts",
    "scripts/seo-audit-agent-api.ts",
  ].map((path) => join(repositoryRoot, path));
  const apiScript = join(repositoryRoot, "scripts/seo-audit-agent-api.ts");

  return [
    "Run the founder-controlled daily SEO and answer-engine audit workflow for the Growth OS in submit mode against https://faithfulsoftware.dev.",
    `Use the stable external run ID ${externalRunId}.`,
    `Use only these project paths: ${allowedFiles.join(", ")}.`,
    "Do not inspect AGENTS files, Nexus vault files, Codex caches or memories, browser data, Git history, or any other user files. Do not run broad filesystem searches.",
    `Use only the supplied local API client at ${apiScript} for application calls. First run \"pnpm tsx ${apiScript} claim\" to claim at most three candidates. For each completed audit, write the strict JSON submission to a private temporary file outside the repository, then run \"pnpm tsx ${apiScript} submit <temporary-file>\". Do not implement request signing, read the Keychain, or call an application endpoint another way. The application, not you, owns database access. Never request or use a database credential.`,
    "For each claimed candidate, research only publicly accessible sources. Produce a rigorous SEO and AEO audit with evidence, source URLs, clear prioritised findings, and specific steps the business can do themselves without a developer. Do not claim that unverified tools or private analytics were used.",
    "Submit one strict JSON bundle per successfully audited candidate to POST /api/agent/seo-audits. The application creates the PDF, stores it, and creates the founder-review email draft. Do not create the PDF locally, write files to the repository, create a Gmail draft, send email, queue an email, commit, deploy, or publish anything.",
    "If no candidates are available, return finalOutcome no_candidates. If one candidate fails, continue with the others and record only redacted totals. Never print a business name, website URL, contact detail, source URL, audit text, email copy, request body, signature, secret, or provider response.",
    "Return only the strict redacted JSON run report defined by the supplied schema. Do not wrap it in Markdown or add commentary.",
  ].join(" ");
}

function buildFailureReport(date: Date): RedactedSeoAuditRunReport {
  return {
    runDate: londonDate(date),
    externalRunId: buildDailySeoAuditExternalRunId(date),
    promptVersion: PROMPT_VERSION,
    finalOutcome: "failed",
    claimed: 0,
    submitted: 0,
    failed: 0,
    failureClass: "agent_failure",
  };
}

export function executeScheduledSeoAuditAgent({
  now = new Date(),
  repositoryRoot,
  codexBinary = "codex",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  executor = runRedactedSeoAuditChild,
  claimReleaser = releaseIncompleteSeoAuditClaims,
}: ExecuteScheduledSeoAuditAgentInput): ScheduledSeoAuditAgentResult {
  let workspace: string | null = null;
  let releaseClaims = false;
  try {
    workspace = mkdtempSync(join(tmpdir(), "fss-seo-audit-"));
    chmodSync(workspace, 0o700);
    const schemaPath = join(workspace, "redacted-report.schema.json");
    const reportPath = join(workspace, "redacted-report.json");
    const claimLedgerPath = join(workspace, "claimed-audit-ids.json");
    writeFileSync(
      schemaPath,
      JSON.stringify(z.toJSONSchema(redactedSeoAuditRunReportSchema)),
      { mode: 0o600 },
    );
    writeFileSync(claimLedgerPath, JSON.stringify({ auditIds: [] }), {
      mode: 0o600,
    });

    const externalRunId = buildDailySeoAuditExternalRunId(now);
    const report = executor({
      command: codexBinary,
      args: [
        "--search",
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--approve-for-me",
        "--skip-git-repo-check",
        "--color",
        "never",
        "--model",
        "gpt-5.6-sol",
        "--config",
        'model_reasoning_effort="high"',
        "--cd",
        repositoryRoot,
        "--output-schema",
        schemaPath,
        "--output-last-message",
        reportPath,
        buildAgentPrompt(repositoryRoot, externalRunId),
      ],
      cwd: repositoryRoot,
      reportPath,
      claimLedgerPath,
      timeoutMs,
    });

    if (
      report.externalRunId !== externalRunId ||
      report.promptVersion !== PROMPT_VERSION
    ) {
      releaseClaims = true;
      return { succeeded: false, report: buildFailureReport(now) };
    }
    releaseClaims = report.finalOutcome === "failed" || report.failed > 0;
    return { succeeded: report.finalOutcome !== "failed", report };
  } catch {
    releaseClaims = true;
    return { succeeded: false, report: buildFailureReport(now) };
  } finally {
    if (workspace !== null && releaseClaims) {
      claimReleaser({
        repositoryRoot,
        claimLedgerPath: join(workspace, "claimed-audit-ids.json"),
      });
    }
    if (workspace !== null) rmSync(workspace, { recursive: true, force: true });
  }
}
