import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDailyResearchRunId,
  researchDailyProspects,
  runDailyResearch,
} from "../lib/growth/research/daily-discovery";
import {
  buildFacebookRunId,
  runFacebookDiscovery,
} from "../lib/growth/facebook/scheduled-discovery";

export async function runPinnedResearch(
  args: string[],
  testPorts: {
    now?: Date;
    secret?: () => string;
    business?: typeof runDailyResearch;
    facebook?: typeof runFacebookDiscovery;
  } = {},
): Promise<boolean> {
  const [mode, stateDirectory, operation, ...extra] = args;
  if (
    extra.length ||
    !stateDirectory ||
    !["business", "facebook"].includes(mode) ||
    !["new", "replay"].includes(operation)
  )
    return false;
  const now = testPorts.now ?? new Date();
  const runId =
    mode === "business"
      ? buildDailyResearchRunId(now)
      : buildFacebookRunId(now);
  const hasState =
    existsSync(join(stateDirectory, `${runId}.json`)) ||
    (mode === "facebook" &&
      existsSync(join(stateDirectory, `${runId}.receipt.json`)));
  if (operation === "replay" && !hasState) return false;
  const noResearch = () => {
    throw new Error("replay_state_missing");
  };
  const secret =
    testPorts.secret ??
    (() =>
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
      ).trim());
  const report =
    mode === "business"
      ? await (testPorts.business ?? runDailyResearch)({
          stateDirectory,
          now,
          research:
            hasState || operation === "replay"
              ? noResearch
              : researchDailyProspects,
          secret,
        })
      : await (testPorts.facebook ?? runFacebookDiscovery)({
          repositoryRoot: process.cwd(),
          stateDirectory,
          now,
          ...(hasState || operation === "replay"
            ? { research: noResearch }
            : {}),
          secret,
        });
  return report.ok;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void runPinnedResearch(process.argv.slice(2))
    .then((ok) => {
      process.exitCode = ok ? 0 : 1;
    })
    .catch(() => {
      process.exitCode = 1;
    });
}
