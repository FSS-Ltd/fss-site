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
) => { success: boolean; stdout: string };

const MAX_EVENT_BYTES = 2 * 1024 * 1024;

// This stream is private process evidence, never model-authored final JSON.
function hasCompletedSearch(stdout: string): boolean {
  if (!stdout || Buffer.byteLength(stdout, "utf8") > MAX_EVENT_BYTES)
    return false;
  let searched = false;
  let completed = false;
  try {
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      if (completed) return false;
      const event: unknown = JSON.parse(line);
      if (!event || typeof event !== "object" || Array.isArray(event))
        return false;
      const value = event as Record<string, unknown>;
      if (value.type === "thread.started") {
        if (typeof value.thread_id !== "string" || !value.thread_id.trim())
          return false;
        continue;
      }
      if (value.type === "turn.started") continue;
      if (value.type === "turn.completed") {
        if (
          !value.usage ||
          typeof value.usage !== "object" ||
          Array.isArray(value.usage)
        )
          return false;
        const usage = value.usage as Record<string, unknown>;
        if (
          ![
            "input_tokens",
            "cached_input_tokens",
            "output_tokens",
            "reasoning_output_tokens",
          ].every(
            (key) =>
              typeof usage[key] === "number" &&
              Number.isSafeInteger(usage[key]) &&
              (usage[key] as number) >= 0,
          )
        )
          return false;
        completed = true;
        continue;
      }
      if (
        value.type !== "item.started" &&
        value.type !== "item.updated" &&
        value.type !== "item.completed"
      )
        return false;
      if (
        !value.item ||
        typeof value.item !== "object" ||
        Array.isArray(value.item)
      )
        return false;
      const item = value.item as Record<string, unknown>;
      if (
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.type !== "string"
      )
        return false;
      if (
        !["web_search", "agent_message", "reasoning", "todo_list"].includes(
          item.type,
        )
      )
        return false;
      if (
        (item.type === "agent_message" || item.type === "reasoning") &&
        typeof item.text !== "string"
      )
        return false;
      if (item.type === "todo_list" && !Array.isArray(item.items)) return false;
      if (item.type === "web_search" && typeof item.query !== "string")
        return false;
      if (item.type === "web_search" && value.type === "item.completed") {
        if (
          typeof item.query !== "string" ||
          !item.query.trim() ||
          !item.action ||
          typeof item.action !== "object" ||
          Array.isArray(item.action)
        )
          return false;
        const action = item.action as Record<string, unknown>;
        if (
          !["search", "open_page", "find_in_page"].includes(String(action.type))
        )
          return false;
        if (action.type === "search") searched = true;
      }
    }
  } catch {
    return false;
  }
  return searched && completed;
}

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
      "skill_search",
      "skill_mcp_dependency_install",
      "workspace_dependencies",
      "in_app_browser",
    ];
    const args = [
      "--search",
      "exec",
      "--json",
      "--ephemeral",
      "--ignore-user-config",
      ...features.flatMap((feature) => ["--disable", feature]),
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--color",
      "never",
      "--model",
      input.model,
      "--config",
      'model_reasoning_effort="high"',
      "--config",
      "skills.include_instructions=false",
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
          stdio: ["ignore", "pipe", "ignore"],
          encoding: "utf8",
          maxBuffer: MAX_EVENT_BYTES,
          timeout: 45 * 60 * 1000,
        });
        return {
          success: result.error === undefined && result.status === 0,
          stdout: result.stdout ?? "",
        };
      });
    const result = execute("codex", args, workspace, env);
    if (!result.success || !hasCompletedSearch(result.stdout))
      throw new Error("research failed");
    const file = lstatSync(outputPath);
    if (!file.isFile() || file.size > 256 * 1024)
      throw new Error("invalid output");
    try {
      return JSON.parse(readFileSync(outputPath, "utf8"));
    } catch {
      throw new Error("invalid output");
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
