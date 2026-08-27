import type { RedactedResearchReport } from "./redacted-run-report";
import type { TriggerScheduledPreviewPullRequestInput } from "./preview-pr-trigger";

export type ScheduledResearchRunResult = {
  succeeded: boolean;
  report: RedactedResearchReport;
};

export type ScheduledResearchWorkflowInput = {
  runResearch: () => ScheduledResearchRunResult;
  readAgentSecret: () => string;
  triggerPreviewPullRequest: (
    input: Pick<
      TriggerScheduledPreviewPullRequestInput,
      "externalRunId" | "secret"
    >,
  ) => Promise<{ ok: boolean }>;
};

export async function runScheduledResearchWorkflow(
  input: ScheduledResearchWorkflowInput,
): Promise<ScheduledResearchRunResult> {
  const research = input.runResearch();
  if (!research.succeeded || research.report.accepted === 0) {
    return research;
  }

  try {
    const previewGeneration = await input.triggerPreviewPullRequest({
      externalRunId: research.report.externalRunId,
      secret: input.readAgentSecret(),
    });
    return previewGeneration.ok ? research : { ...research, succeeded: false };
  } catch {
    return { ...research, succeeded: false };
  }
}
