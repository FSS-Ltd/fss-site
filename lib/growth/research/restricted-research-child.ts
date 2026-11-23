import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export type RestrictedResearchExecutor = (
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
) => boolean;

export function runRestrictedResearchChild(input: {
  schema: object;
  prompt: string;
  model: string;
  execute?: RestrictedResearchExecutor;
}): unknown {
  const workspace = mkdtempSync(join(tmpdir(), "fss-research-child-"));
  chmodSync(workspace, 0o700);
  try {
    const schemaPath = join(workspace, "schema.json");
    const outputPath = join(workspace, "output.json");
    writeFileSync(schemaPath, JSON.stringify(input.schema), { mode: 0o600 });
    const features = [
      "shell_tool",
      "unified_exec",
      "apps",
      "hooks",
      "multi_agent",
      "plugins",
      "computer_use",
      "browser_use",
      "browser_use_external",
      "browser_use_full_cdp_access",
      "view_image",
      "image_generation",
      "code_mode_host",
      "skill_mcp_dependency_install",
      "workspace_dependencies",
      "in_app_browser",
    ];
    const args = [
      "--search",
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      ...features.flatMap((feature) => ["--disable", feature]),
      "--enable",
      "skip_host_skill_discovery",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--model",
      input.model,
      "--config",
      'model_reasoning_effort="high"',
      "--cd",
      workspace,
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      input.prompt,
    ];
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      HOME: homedir(),
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      TMPDIR: workspace,
      ...(process.env.CODEX_HOME ? { CODEX_HOME: process.env.CODEX_HOME } : {}),
    };
    const execute: RestrictedResearchExecutor =
      input.execute ??
      ((command, childArgs, cwd, childEnv) => {
        const result = spawnSync(command, childArgs, {
          cwd,
          env: childEnv,
          stdio: "ignore",
          timeout: 45 * 60 * 1000,
        });
        return result.error === undefined && result.status === 0;
      });
    if (!execute("codex", args, workspace, env))
      throw new Error("research failed");
    const file = lstatSync(outputPath);
    if (!file.isFile() || file.size > 256 * 1024)
      throw new Error("invalid output");
    return JSON.parse(readFileSync(outputPath, "utf8"));
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
