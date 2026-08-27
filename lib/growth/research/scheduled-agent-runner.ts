import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import {
  type RedactedResearchReport,
  redactedResearchReportSchema,
  runRedactedChildProcess,
} from "./redacted-run-report";

const PROMPT_VERSION = "weekday-research-v1";
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;

type ResearchAgentExecutionInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  reportPath: string;
  timeoutMs: number;
};

export type ResearchAgentExecutor = (
  input: ResearchAgentExecutionInput,
) => RedactedResearchReport;

type ExecuteScheduledResearchAgentInput = {
  now?: Date;
  repositoryRoot: string;
  codexBinary?: string;
  timeoutMs?: number;
  executor?: ResearchAgentExecutor;
};

type ScheduledResearchAgentResult = {
  succeeded: boolean;
  report: RedactedResearchReport;
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

export function buildWeekdayExternalRunId(date: Date): string {
  return `weekday-${londonDate(date)}-0600-europe-london-v1`;
}

function buildAgentPrompt(
  repositoryRoot: string,
  externalRunId: string,
): string {
  const allowedFiles = [
    "docs/growth-os/prompts/weekday-research.md",
    "docs/growth-os/runbooks/scheduled-research.md",
    "docs/growth-os/fixtures/research-run-v1.json",
    "lib/growth/research/ingestion-schema.ts",
    "lib/growth/research/types.ts",
    "lib/growth/prospect-previews/experience-brief.ts",
    "lib/growth/prospect-previews/assets/route-handler.ts",
    "lib/growth/email/assets/fallbacks.ts",
  ].map((path) => join(repositoryRoot, path));

  return [
    "Run the founder-controlled Growth OS weekday company research workflow in submit mode against https://faithfulsoftware.dev.",
    `Use the stable external run ID ${externalRunId}.`,
    `Read only these files: ${allowedFiles.join(", ")}.`,
    "Do not inspect AGENTS files, Nexus vault files, Codex caches or memories, Library/Application Support, browser data, Git history, or any other user files. Do not run broad filesystem searches.",
    "Use web search for permitted research. Do not use browser-control automation.",
    "For every accepted candidate, prepare one first-party strength and two or three sourced website-journey improvements for the reviewable initial email. After founder approval, the application adds the built-example close and private preview URL; do not publish the URL or send email.",
    "Never call /api/agent/prospect-preview-prs or use GitHub. The trusted parent scheduler creates review pull requests only after your signed research submission succeeds.",
    "Load GROWTH_OS_AGENT_HMAC_SECRET only at runtime from macOS Keychain service dev.faithfulsoftware.growth-os.agent-hmac and account growth-os-weekday-company-research. Keep it in process memory only and never print or persist it.",
    "Create any temporary bundle or helper only inside the current disposable working directory. Delete it before finishing. Never print a secret, signature, raw bundle, email address, contact name, raw URL, email copy, or assessment text.",
    "Validate the complete version 1.1 bundle against the repository contract, sign and submit the exact bytes. For every accepted candidate, collect first-party preview evidence only: logo, brand colours, real service language, and eligible on-site imagery when present. Every item needs its first-party source URL, observed timestamp, and a short evidence text. Build an evidence-backed hero statement and an explicit customer journey from that evidence. Never use Google Maps, third-party assets, or generic sector headlines in preview evidence.",
    "No AI image API calls. After the signed research submission succeeds and returns the prospect IDs, upload only found first-party logo or on-site image files through /api/agent/prospect-preview-assets. Sign each exact multipart request with the same agent HMAC headers. Include the matching run ID, prospect ID, preview evidence ID, exact first-party source URL, asset kind, meaningful alt text, and file. Do not upload generated 3D or hero media: that remains a separate founder-approved step.",
    "Never create a Gmail draft and never send email.",
    "Return every controlled rejection reason key with an integer count, including zeroes, and make the reason counts sum exactly to the rejected total.",
    "Return only the redacted JSON run report required by the output schema. Do not wrap it in Markdown or add commentary.",
  ].join(" ");
}

function buildFailureReport(date: Date): RedactedResearchReport {
  return {
    runDate: londonDate(date),
    mode: "submit",
    externalRunId: buildWeekdayExternalRunId(date),
    promptVersion: PROMPT_VERSION,
    finalOutcome: "failed",
    httpStatus: null,
    correlationId: null,
    accepted: 0,
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
      fallbackRetained: 0,
    },
    attemptCount: 0,
    failureClass: "agent_failure",
  };
}

export function executeScheduledResearchAgent({
  now = new Date(),
  repositoryRoot,
  codexBinary = "codex",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  executor = runRedactedChildProcess,
}: ExecuteScheduledResearchAgentInput): ScheduledResearchAgentResult {
  const workspace = mkdtempSync(join(tmpdir(), "fss-growth-research-"));
  chmodSync(workspace, 0o700);

  try {
    const schemaPath = join(workspace, "redacted-report.schema.json");
    const reportPath = join(workspace, "redacted-report.json");
    writeFileSync(
      schemaPath,
      JSON.stringify(z.toJSONSchema(redactedResearchReportSchema)),
      { mode: 0o600 },
    );

    const externalRunId = buildWeekdayExternalRunId(now);
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
        workspace,
        "--output-schema",
        schemaPath,
        "--output-last-message",
        reportPath,
        buildAgentPrompt(repositoryRoot, externalRunId),
      ],
      cwd: workspace,
      reportPath,
      timeoutMs,
    });

    return {
      succeeded: report.finalOutcome === "submitted",
      report,
    };
  } catch {
    return {
      succeeded: false,
      report: buildFailureReport(now),
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
