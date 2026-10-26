import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import { globalResearchRunSchema } from "../lib/growth/research/global-schema";
import { MAX_RESEARCH_BUNDLE_BYTES } from "../lib/growth/research/limits";
import { submitGlobalResearch } from "../lib/growth/research/submission-client";

async function main(): Promise<void> {
  const [payloadPath, ...extra] = process.argv.slice(2);
  if (!payloadPath || extra.length > 0)
    throw new Error("Expected one private payload path");
  const stat = statSync(payloadPath);
  if (
    !stat.isFile() ||
    stat.size > MAX_RESEARCH_BUNDLE_BYTES ||
    (stat.mode & 0o077) !== 0
  ) {
    throw new Error("Payload must be private and within the byte limit");
  }
  const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(
    readFileSync(payloadPath),
  );
  globalResearchRunSchema.parse(JSON.parse(rawBody));
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
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
  const report = await submitGlobalResearch({
    rawBody,
    secret,
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
