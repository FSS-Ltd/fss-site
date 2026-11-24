import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import test from "node:test";
import { runRestrictedResearchChild } from "./restricted-research-child";

const completed = {
  type: "turn.completed",
  usage: {
    input_tokens: 1,
    cached_input_tokens: 0,
    output_tokens: 1,
    reasoning_output_tokens: 0,
  },
};
const search = {
  type: "item.completed",
  item: {
    id: "search-1",
    type: "web_search",
    query: "public information",
    action: { type: "search", query: "public information" },
  },
};
const jsonl = (...events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

function exercise(stdout: string, success = true): unknown {
  let workspace = "";
  try {
    return runRestrictedResearchChild({
      schema: {},
      prompt: "synthetic",
      model: "test-model",
      execute: (_command, args, cwd) => {
        workspace = cwd;
        assert.ok(args.includes("--json"));
        writeFileSync(
          args[args.indexOf("--output-last-message") + 1]!,
          JSON.stringify({ succeeded: true, prospects: [] }),
        );
        return { success, stdout };
      },
    });
  } finally {
    assert.ok(workspace);
    assert.equal(existsSync(workspace), false);
  }
}

test("accepts only a completed native search in a successful execution stream", () => {
  assert.deepEqual(exercise(jsonl(search, completed)), {
    succeeded: true,
    prospects: [],
  });
  const started = { ...search, type: "item.started" };
  const page = {
    ...search,
    item: {
      ...search.item,
      action: { type: "open_page", url: "https://example.org" },
    },
  };
  const fabricated = {
    type: "item.completed",
    item: {
      id: "message-1",
      type: "agent_message",
      text: JSON.stringify(search),
    },
  };
  const forbidden = [
    "command_execution",
    "mcp_tool_call",
    "file_change",
    "collab_tool_call",
  ].map((type) => ({
    type: "item.completed",
    item: { id: "forbidden", type },
  }));
  const bad = [
    jsonl(completed),
    jsonl(started, completed),
    jsonl(page, completed),
    jsonl(fabricated, completed),
    jsonl(search),
    jsonl({ type: "thread.started" }, search, completed),
    jsonl(
      {
        type: "item.completed",
        item: { id: "message", type: "agent_message" },
      },
      search,
      completed,
    ),
    jsonl(search, { type: "turn.completed" }),
    jsonl(search, { type: "turn.failed", error: {} }),
    jsonl({ ...search, item: { ...search.item, id: "" } }, completed),
    jsonl({ ...search, item: { ...search.item, query: "" } }, completed),
    jsonl({ ...search, item: { ...search.item, action: null } }, completed),
    "{malformed\n" + jsonl(search, completed),
    ...forbidden.map((event) => jsonl(search, event, completed)),
    jsonl(search, completed, search),
    "x".repeat(2 * 1024 * 1024 + 1),
  ];
  for (const stream of bad)
    assert.throws(() => exercise(stream), /research failed/);
  assert.throws(
    () => exercise(jsonl(search, completed), false),
    /research failed/,
  );
});

test("keeps the bundled code-mode host available while disabling restricted tools", () => {
  runRestrictedResearchChild({
    schema: {},
    prompt: "synthetic",
    model: "test-model",
    execute: (_command, args) => {
      const disabled = args.flatMap((arg, index) =>
        arg === "--disable" ? [args[index + 1]] : [],
      );
      assert.equal(disabled.includes("code_mode_host"), false);
      for (const feature of [
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
        "skill_mcp_dependency_install",
        "workspace_dependencies",
        "in_app_browser",
      ])
        assert.ok(disabled.includes(feature), feature);
      assert.ok(args.includes("skip_host_skill_discovery"));
      assert.ok(args.includes("suppress_unstable_features_warning=true"));
      assert.ok(args.includes("--ignore-user-config"));
      assert.ok(args.includes("--ephemeral"));
      assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
      writeFileSync(args[args.indexOf("--output-last-message") + 1]!, "{}");
      return { success: true, stdout: jsonl(search, completed) };
    },
  });
});
