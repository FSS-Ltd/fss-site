import { execFileSync } from "node:child_process";
import { isAbsolute } from "node:path";
import {
  researchDailyProspects,
  runDailyResearch,
} from "../lib/growth/research/daily-discovery";

async function main(): Promise<void> {
  const [stateDirectory, ...extra] = process.argv.slice(2);
  if (!stateDirectory || !isAbsolute(stateDirectory) || extra.length)
    throw Error("Expected an absolute private state directory");
  const report = await runDailyResearch({
    stateDirectory,
    research: researchDailyProspects,
    secret: () =>
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
      ).trim(),
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.ok) process.exitCode = 1;
}

void main().catch(() => {
  process.stdout.write(
    `${JSON.stringify({ ok: false, reason: "local_setup_failed" })}\n`,
  );
  process.exitCode = 1;
});
