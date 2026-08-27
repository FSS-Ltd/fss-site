import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { triggerScheduledPreviewPullRequest } from "../lib/growth/research/preview-pr-trigger";
import { executeScheduledResearchAgent } from "../lib/growth/research/scheduled-agent-runner";
import { runScheduledResearchWorkflow } from "../lib/growth/research/scheduled-workflow";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readAgentSecret(): string {
  const secret = execFileSync(
    "/usr/bin/security",
    [
      "find-generic-password",
      "-s",
      "dev.faithfulsoftware.growth-os.agent-hmac",
      "-a",
      "growth-os-weekday-company-research",
      "-w",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
  if (secret.replace(/\s/g, "").length < 32) {
    throw new Error("Scheduled agent signing secret is invalid.");
  }
  return secret;
}

async function main(): Promise<void> {
  const result = await runScheduledResearchWorkflow({
    runResearch: () => executeScheduledResearchAgent({ repositoryRoot }),
    readAgentSecret,
    triggerPreviewPullRequest: triggerScheduledPreviewPullRequest,
  });

  process.stdout.write(`${JSON.stringify(result.report)}\n`);
  if (!result.succeeded) process.exitCode = 1;
}

void main().catch(() => {
  process.exitCode = 1;
});
