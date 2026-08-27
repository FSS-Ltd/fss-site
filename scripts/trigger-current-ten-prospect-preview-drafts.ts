import { execFileSync } from "node:child_process";

import { triggerCurrentTenDraftPreviewBackfill } from "../lib/growth/research/preview-pr-trigger";

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
    throw new Error("Current-ten signing secret is invalid.");
  }
  return secret;
}

async function main(): Promise<void> {
  const result = await triggerCurrentTenDraftPreviewBackfill({
    secret: readAgentSecret(),
  });
  if (!result.ok) {
    throw new Error("Current-ten preview draft backfill did not return a valid response.");
  }
  process.stdout.write("Current-ten preview draft backfill completed.\n");
}

void main().catch(() => {
  process.stderr.write("Current-ten preview draft backfill failed.\n");
  process.exitCode = 1;
});
