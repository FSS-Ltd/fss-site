import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { z } from "zod";

const safeIdentifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/);
const count = z.number().int().nonnegative();
const rejectionReasonTotalsSchema = z
  .object({
    outside_kent: count,
    ineligible_corporate_type: count,
    inactive_company: count,
    personal_subscriber: count,
    uncertain_partnership: count,
    unverifiable_work_email: count,
    unsupported_claim: count,
    insufficient_opportunity_evidence: count,
    known_duplicate: count,
    suppressed_contact: count,
  })
  .strict();

export const redactedResearchReportSchema = z
  .object({
    runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(["dry-run", "submit"]),
    externalRunId: safeIdentifier,
    promptVersion: safeIdentifier,
    finalOutcome: z.enum(["submitted", "failed", "stopped"]),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    correlationId: safeIdentifier.nullable(),
    accepted: count,
    duplicate: count,
    rejected: count,
    rejectionReasonTotals: rejectionReasonTotalsSchema,
    targetOfTenMet: z.boolean(),
    visuals: z
      .object({
        generationAttempted: count,
        uploaded: count,
        failed: count,
        fallbackRetained: count,
      })
      .strict(),
    attemptCount: z.number().int().min(0).max(3),
    failureClass: z
      .enum([
        "timeout",
        "unauthorized",
        "invalid_bundle",
        "suppressed_contact",
        "server_error",
        "connection_failure",
        "clock_skew",
        "agent_failure",
      ])
      .nullable(),
  })
  .strict()
  .superRefine((report, context) => {
    const rejectionReasonTotal = Object.values(
      report.rejectionReasonTotals,
    ).reduce((total, value) => total + value, 0);

    if (rejectionReasonTotal !== report.rejected) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReasonTotals"],
        message: "Rejection reason totals must equal the rejected count.",
      });
    }
  });

export type RedactedResearchReport = z.infer<
  typeof redactedResearchReportSchema
>;

export class ResearchAgentOutputError extends Error {
  constructor() {
    super("Research agent output was not safe.");
    this.name = "ResearchAgentOutputError";
  }
}

export function parseRedactedResearchReport(
  rawReport: string,
): RedactedResearchReport {
  try {
    return redactedResearchReportSchema.parse(JSON.parse(rawReport));
  } catch {
    throw new ResearchAgentOutputError();
  }
}

type RunRedactedChildProcessInput = {
  command: string;
  args: readonly string[];
  cwd: string;
  reportPath: string;
  timeoutMs: number;
};

export function runRedactedChildProcess({
  command,
  args,
  cwd,
  reportPath,
  timeoutMs,
}: RunRedactedChildProcessInput): RedactedResearchReport {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "ignore", "ignore"],
    timeout: timeoutMs,
  });

  if (result.error !== undefined || result.status !== 0) {
    throw new ResearchAgentOutputError();
  }

  try {
    return parseRedactedResearchReport(readFileSync(reportPath, "utf8"));
  } catch {
    throw new ResearchAgentOutputError();
  }
}
