import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { executeScheduledSeoAuditAgent } from "../lib/growth/seo-audits/scheduled-agent-runner";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codexBinary = process.env.GROWTH_OS_CODEX_BINARY;

const result = executeScheduledSeoAuditAgent({
  repositoryRoot,
  ...(codexBinary === undefined ? {} : { codexBinary }),
});

process.stdout.write(`${JSON.stringify(result.report)}\n`);
if (!result.succeeded) process.exitCode = 1;
