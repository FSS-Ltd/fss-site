import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildDailyResearchRunId,
  researchDailyProspects,
  runDailyResearch,
} from "../lib/growth/research/daily-discovery";
import {
  buildFacebookRunId,
  runFacebookDiscovery,
} from "../lib/growth/facebook/scheduled-discovery";

async function run(): Promise<boolean> {
  const [mode, stateDirectory, operation, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !stateDirectory ||
    !["business", "facebook"].includes(mode) ||
    !["new", "replay"].includes(operation)
  )
    return false;
  const now = new Date();
  const runId =
    mode === "business"
      ? buildDailyResearchRunId(now)
      : buildFacebookRunId(now);
  const hasState =
    existsSync(join(stateDirectory, `${runId}.json`)) ||
    (mode === "facebook" &&
      existsSync(join(stateDirectory, `${runId}.receipt.json`)));
  if ((operation === "replay") !== hasState) return false;
  const noResearch = () => {
    throw new Error("replay_state_missing");
  };
  const secret = () =>
    execFileSync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-s",
        "dev.faithfulsoftware.growth-os.agent-hmac",
        "-a",
        "growth-os-weekday-company-research",
        "-w",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  const report =
    mode === "business"
      ? await runDailyResearch({
          stateDirectory,
          now,
          research:
            operation === "replay" ? noResearch : researchDailyProspects,
          secret,
        })
      : await runFacebookDiscovery({
          repositoryRoot: process.cwd(),
          stateDirectory,
          now,
          ...(operation === "replay" ? { research: noResearch } : {}),
          secret,
        });
  return report.ok;
}
void run()
  .then((ok) => {
    process.exitCode = ok ? 0 : 1;
  })
  .catch(() => {
    process.exitCode = 1;
  });
