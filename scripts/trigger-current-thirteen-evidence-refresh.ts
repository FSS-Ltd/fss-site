import { execFileSync } from "node:child_process";

import { isCurrentThirteenEvidenceRefreshRunId } from "../lib/growth/prospect-previews/generation/current-thirteen-evidence-refresh";
import { triggerCurrentThirteenEvidenceRefresh } from "../lib/growth/research/preview-pr-trigger";

function readRunId(argumentsList: readonly string[]): string {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--run-id") {
    throw new Error(
      "Usage: pnpm growth:previews:trigger-evidence-refresh -- --run-id evidence-refresh-thirteen-YYYY-MM-DD",
    );
  }
  const runId = argumentsList[1];
  if (!runId || !isCurrentThirteenEvidenceRefreshRunId(runId)) {
    throw new Error("Current thirteen-draft evidence refresh run ID is invalid.");
  }
  return runId;
}

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
    throw new Error("Evidence-refresh signing secret is invalid.");
  }
  return secret;
}

async function main(): Promise<void> {
  const result = await triggerCurrentThirteenEvidenceRefresh({
    externalRunId: readRunId(process.argv.slice(2)),
    secret: readAgentSecret(),
  });
  if (!result.ok) {
    throw new Error("Evidence-refresh source trigger did not return a valid response.");
  }
  process.stdout.write("Evidence-refresh source trigger completed.\n");
}

void main().catch(() => {
  process.stderr.write("Evidence-refresh source trigger failed.\n");
  process.exitCode = 1;
});
