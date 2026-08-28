import type { RedactedResearchReport } from "./redacted-run-report";

export type ScheduledResearchRunResult = {
  succeeded: boolean;
  report: RedactedResearchReport;
};

export type ScheduledResearchWorkflowInput = {
  runResearch: () => ScheduledResearchRunResult;
};

export async function runScheduledResearchWorkflow(
  input: ScheduledResearchWorkflowInput,
): Promise<ScheduledResearchRunResult> {
  return input.runResearch();
}
