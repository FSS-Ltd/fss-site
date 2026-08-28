import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { executeScheduledResearchAgent } from "../lib/growth/research/scheduled-agent-runner";
import { runScheduledResearchWorkflow } from "../lib/growth/research/scheduled-workflow";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const result = await runScheduledResearchWorkflow({
    runResearch: () => executeScheduledResearchAgent({ repositoryRoot }),
  });

  process.stdout.write(`${JSON.stringify(result.report)}\n`);
  if (!result.succeeded) process.exitCode = 1;
}

void main().catch(() => {
  process.exitCode = 1;
});
