import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runFacebookDiscovery } from "../lib/growth/facebook/scheduled-discovery";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
async function main(): Promise<void> {
  const result = await runFacebookDiscovery({
    repositoryRoot,
    stateDirectory: join(homedir(), ".fss-facebook-discovery"),
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
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

void main().catch(() => {
  process.stdout.write(
    `${JSON.stringify({ ok: false, reason: "local_setup_failed", httpStatus: null, attempts: 0 })}\n`,
  );
  process.exitCode = 1;
});
