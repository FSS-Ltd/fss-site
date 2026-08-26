import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { executeScheduledResearchAgent } from "../lib/growth/research/scheduled-agent-runner";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const result = executeScheduledResearchAgent({ repositoryRoot });

process.stdout.write(`${JSON.stringify(result.report)}\n`);
if (!result.succeeded) process.exitCode = 1;
