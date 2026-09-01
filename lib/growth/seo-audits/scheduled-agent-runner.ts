import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { seoAuditSubmissionSchema } from "./schema";

const PROMPT_VERSION = "daily-seo-audit-v1";
const DEFAULT_TIMEOUT_MS = 45 * 60 * 1_000;
const MAX_SUBMISSION_BYTES = 128 * 1024;

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
  candidatePath: string;
  submissionDirectory: string;
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

const agentClaimResponseSchema = z
  .object({
    ok: z.literal(true),
    candidates: z.array(z.object({ auditId: z.string().uuid() }).passthrough()),
  })
  .passthrough();

type SeoAuditClaim = {
  candidateJson: string;
  auditIds: readonly string[];
};

export type SeoAuditCandidateClaimer = (input: {
  repositoryRoot: string;
  claimLedgerPath: string;
}) => SeoAuditClaim;

function claimSeoAuditCandidatesForAgent(input: {
  repositoryRoot: string;
  claimLedgerPath: string;
}): SeoAuditClaim {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/seo-audit-agent-api.ts", "claim"],
    {
      cwd: input.repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        GROWTH_OS_SEO_AUDIT_CLAIM_LEDGER_PATH: input.claimLedgerPath,
      },
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    throw new Error("SEO audit candidates could not be claimed.");
  }
  if (result.stdout.length > 128 * 1024) {
    throw new Error("SEO audit candidate response is too large.");
  }

  const parsed = agentClaimResponseSchema.parse(
    JSON.parse(result.stdout) as unknown,
  );
  return {
    candidateJson: result.stdout,
    auditIds: parsed.candidates.map((candidate) => candidate.auditId),
  };
}

export type SeoAuditSubmissionResult =
  | { status: "submitted" }
  | { status: "failed"; httpStatus: number | null };

export type SeoAuditSubmissionRunner = (input: {
  repositoryRoot: string;
  submissionPath: string;
}) => SeoAuditSubmissionResult;

const agentApiFailureSchema = z
  .object({
    ok: z.literal(false),
    status: z.number().int().min(400).max(599),
  })
  .strict();

function readAgentApiFailureStatus(stdout: string): number | null {
  try {
    const parsed = agentApiFailureSchema.safeParse(
      JSON.parse(stdout) as unknown,
    );
    return parsed.success ? parsed.data.status : null;
  } catch {
    return null;
  }
}

function submitPreparedSeoAudit(input: {
  repositoryRoot: string;
  submissionPath: string;
}): SeoAuditSubmissionResult {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/seo-audit-agent-api.ts",
      "submit",
      input.submissionPath,
    ],
    {
      cwd: input.repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    },
  );
  if (result.error === undefined && result.status === 0) {
    return { status: "submitted" };
  }
  return {
    status: "failed",
    httpStatus: readAgentApiFailureStatus(result.stdout),
  };
}

function isValidSeoAuditSubmissionFile(
  submissionPath: string,
  auditId: string,
): boolean {
  try {
    const parsed = seoAuditSubmissionSchema.safeParse(
      JSON.parse(readFileSync(submissionPath, "utf8")) as unknown,
    );
    return parsed.success && parsed.data.auditId === auditId;
  } catch {
    return false;
  }
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
  candidateClaimer?: SeoAuditCandidateClaimer;
  submissionRunner?: SeoAuditSubmissionRunner;
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
  candidatePath: string,
  submissionDirectory: string,
): string {
  const allowedFiles = [
    "docs/growth-os/prompts/daily-seo-audit.md",
    "docs/growth-os/runbooks/scheduled-seo-audits.md",
    "lib/growth/seo-audits/schema.ts",
  ].map((path) => join(repositoryRoot, path));

  return [
    "Run the founder-controlled daily SEO and answer-engine audit workflow for the Growth OS in submit mode against https://faithfulsoftware.dev.",
    `Use the stable external run ID ${externalRunId}.`,
    `Use only these project paths: ${allowedFiles.join(", ")}, ${candidatePath}, and ${submissionDirectory}.`,
    "Do not inspect AGENTS files, Nexus vault files, Codex caches or memories, browser data, Git history, or any other user files. Do not run broad filesystem searches.",
    `Read the candidate response from ${candidatePath}. The trusted scheduler wrapper owns candidate claims, request signing, and final submission. Do not access the Keychain, run ${join(repositoryRoot, "scripts/seo-audit-agent-api.ts")}, implement request signing, or call an application endpoint. Never request or use a database credential.`,
    "For each claimed candidate, research only publicly accessible sources. Produce a rigorous SEO and AEO audit with evidence, source URLs, clear prioritised findings, and specific steps the business can do themselves without a developer. Do not claim that unverified tools or private analytics were used.",
    `For each completed candidate, write one raw JSON submission that exactly conforms to seoAuditSubmissionSchema to ${submissionDirectory}/<auditId>.json, where <auditId> exactly matches the candidate audit ID. Do not use Markdown fences or add keys beyond the schema. The email paragraphs must collectively contain 80 to 160 words because the application adds the PDF-link and opt-out paragraphs before enforcing its final 70 to 220 word email limit. The wrapper validates and submits each file, then the application creates the PDF, stores it, and creates the founder-review email draft. Do not create the PDF locally, write files to the repository, create a Gmail draft, send email, queue an email, commit, deploy, or publish anything.`,
    "In the redacted report, count each valid submission file you write as submitted; the wrapper determines the final application submission result. If one candidate fails, continue with the others and record only redacted totals. Never print a business name, website URL, contact detail, source URL, audit text, email copy, request body, signature, secret, or provider response.",
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
  candidateClaimer = claimSeoAuditCandidatesForAgent,
  submissionRunner = submitPreparedSeoAudit,
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
    const candidatePath = join(workspace, "candidates.json");
    const submissionDirectory = join(workspace, "submissions");
    writeFileSync(
      schemaPath,
      JSON.stringify(z.toJSONSchema(redactedSeoAuditRunReportSchema)),
      { mode: 0o600 },
    );
    writeFileSync(claimLedgerPath, JSON.stringify({ auditIds: [] }), {
      mode: 0o600,
    });
    mkdirSync(submissionDirectory, { mode: 0o700 });

    const externalRunId = buildDailySeoAuditExternalRunId(now);
    const claimed = candidateClaimer({ repositoryRoot, claimLedgerPath });
    if (claimed.auditIds.length === 0) {
      return {
        succeeded: true,
        report: {
          runDate: londonDate(now),
          externalRunId,
          promptVersion: PROMPT_VERSION,
          finalOutcome: "no_candidates",
          claimed: 0,
          submitted: 0,
          failed: 0,
          failureClass: null,
        },
      };
    }
    writeFileSync(candidatePath, claimed.candidateJson, { mode: 0o600 });

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
        buildAgentPrompt(
          repositoryRoot,
          externalRunId,
          candidatePath,
          submissionDirectory,
        ),
      ],
      cwd: repositoryRoot,
      reportPath,
      candidatePath,
      submissionDirectory,
      claimLedgerPath,
      timeoutMs,
    });

    if (
      report.externalRunId !== externalRunId ||
      report.promptVersion !== PROMPT_VERSION ||
      report.claimed !== claimed.auditIds.length
    ) {
      releaseClaims = true;
      return { succeeded: false, report: buildFailureReport(now) };
    }

    let submitted = 0;
    let invalidSubmissionCount = 0;
    const submissionFailureStatuses = new Set<number>();
    for (const auditId of claimed.auditIds) {
      const submissionPath = join(submissionDirectory, `${auditId}.json`);
      if (!existsSync(submissionPath)) {
        continue;
      }
      const submission = statSync(submissionPath);
      if (
        !submission.isFile() ||
        submission.size === 0 ||
        submission.size > MAX_SUBMISSION_BYTES
      ) {
        invalidSubmissionCount += 1;
        continue;
      }
      if (!isValidSeoAuditSubmissionFile(submissionPath, auditId)) {
        invalidSubmissionCount += 1;
        continue;
      }
      const outcome = submissionRunner({ repositoryRoot, submissionPath });
      if (outcome.status === "submitted") {
        submitted += 1;
      } else if (outcome.httpStatus !== null) {
        submissionFailureStatuses.add(outcome.httpStatus);
      }
    }
    if (invalidSubmissionCount > 0) {
      console.error("SEO audit wrapper rejected invalid agent submissions.", {
        count: invalidSubmissionCount,
      });
    }
    if (submissionFailureStatuses.size > 0) {
      console.error("SEO audit submission requests failed.", {
        httpStatuses: [...submissionFailureStatuses].sort(),
      });
    }
    const failed = claimed.auditIds.length - submitted;
    const finalReport: RedactedSeoAuditRunReport = {
      runDate: londonDate(now),
      externalRunId,
      promptVersion: PROMPT_VERSION,
      finalOutcome: submitted > 0 ? "submitted" : "failed",
      claimed: claimed.auditIds.length,
      submitted,
      failed,
      failureClass:
        failed === 0
          ? null
          : invalidSubmissionCount > 0 ||
              report.failed > 0 ||
              report.finalOutcome === "failed"
            ? "agent_failure"
            : "submission_failure",
    };
    releaseClaims = failed > 0;
    return { succeeded: failed === 0, report: finalReport };
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
