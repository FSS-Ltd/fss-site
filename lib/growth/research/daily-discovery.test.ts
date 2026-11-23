import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { before, after } from "node:test";
import { createGlobalResearchFixture } from "./global-test-fixture";
import {
  buildDailyResearchRunId,
  researchDailyProspects,
  runDailyResearch,
} from "./daily-discovery";

const originalFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = async () => {
    throw new Error("Network access is forbidden in daily research tests");
  };
});
after(() => {
  globalThis.fetch = originalFetch;
});

const secret = "test-only-secret-at-least-thirty-two-characters";
const success = {
  ok: true as const,
  result: {
    ok: true as const,
    runId: "00000000-0000-4000-8000-000000000001",
    accepted: 1,
    duplicates: 0,
    rejected: 0,
    acceptedProspects: [
      { candidateIndex: 0, prospectId: "00000000-0000-4000-8000-000000000002" },
    ],
  },
  attempts: 1,
};

test("uses London calendar date across midnight and DST", () => {
  assert.equal(
    buildDailyResearchRunId(new Date("2026-03-28T23:30:00Z")),
    "daily-2026-03-28-0700-europe-london-v2",
  );
  assert.equal(
    buildDailyResearchRunId(new Date("2026-03-29T23:30:00Z")),
    "daily-2026-03-30-0700-europe-london-v2",
  );
  assert.equal(
    buildDailyResearchRunId(new Date("2026-10-25T23:30:00Z")),
    "daily-2026-10-25-0700-europe-london-v2",
  );
});

test("retains exact body across uncertain submission and replays without research", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "research-test-"));
  try {
    const candidate = createGlobalResearchFixture().prospects[0];
    let body = "";
    const first = await runDailyResearch({
      stateDirectory,
      now: new Date("2026-10-26T09:00:00Z"),
      research: () => ({
        succeeded: true,
        prospects: [candidate],
        rejections: [],
      }),
      secret: () => secret,
      submit: async ({ rawBody }) => {
        body = rawBody;
        return {
          ok: false,
          reason: "transport_error",
          httpStatus: null,
          attempts: 3,
        };
      },
    });
    assert.equal(first.ok, false);
    const second = await runDailyResearch({
      stateDirectory,
      now: new Date("2026-10-26T10:00:00Z"),
      research: () => {
        throw Error("must replay");
      },
      secret: () => secret,
      submit: async ({ rawBody }) => {
        assert.equal(rawBody, body);
        return success;
      },
    });
    assert.equal(second.ok, true);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("distinguishes search failure and successful empty research", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "research-test-"));
  try {
    const base = {
      stateDirectory,
      now: new Date("2026-10-26T07:00:00Z"),
      secret: () => secret,
    };
    const failed = await runDailyResearch({
      ...base,
      research: () => ({ succeeded: false, prospects: [], rejections: [] }),
      submit: async () => {
        throw Error("must not submit");
      },
    });
    assert.equal(failed.ok, false);
    const empty = await runDailyResearch({
      ...base,
      research: () => ({ succeeded: true, prospects: [], rejections: [] }),
      submit: async ({ rawBody }) => {
        assert.equal(JSON.parse(rawBody).outcome, "no_results");
        return {
          ok: true,
          result: { ...success.result, accepted: 0, acceptedProspects: [] },
          attempts: 1,
        };
      },
    });
    assert.equal(empty.ok, true);
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("rejects untrusted proof and oversized batches before signing", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "research-test-"));
  try {
    const candidate = createGlobalResearchFixture().prospects[0];
    for (const prospects of [
      [{ ...candidate, proof: { purpose: "campaign_source_proof" } }],
      Array(11).fill(candidate),
    ]) {
      const result = await runDailyResearch({
        stateDirectory,
        research: () => ({ succeeded: true, prospects, rejections: [] }),
        secret: () => {
          throw Error("must not access credential");
        },
      });
      assert.equal(result.ok, false);
    }
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("rejects future observations before accessing credentials", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "research-test-"));
  try {
    const candidate = createGlobalResearchFixture().prospects[0];
    const result = await runDailyResearch({
      stateDirectory,
      now: new Date("2026-10-26T07:00:00Z"),
      research: () => ({
        succeeded: true,
        prospects: [candidate],
        rejections: [],
      }),
      secret: () => {
        throw Error("must not access credential");
      },
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "invalid_research",
      attempts: 0,
    });
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

test("runs restricted child in disposable workspace and rejects credential exposure", () => {
  let workspace = "";
  const result = researchDailyProspects((command, args, cwd, env) => {
    workspace = cwd;
    assert.equal(command, "codex");
    assert.notEqual(cwd, process.cwd());
    assert.ok(args.includes("--ignore-user-config"));
    assert.equal(args.includes("--ignore-rules"), false);
    for (const feature of [
      "shell_tool",
      "apps",
      "hooks",
      "multi_agent",
      "view_image",
    ])
      assert.ok(args.includes(feature));
    assert.equal(env.GROWTH_OS_AGENT_HMAC_SECRET, undefined);
    const path = args[args.indexOf("--output-last-message") + 1];
    writeFileSync(
      path,
      JSON.stringify({ succeeded: true, prospects: [], rejections: [] }),
      { mode: 0o600 },
    );
    return true;
  });
  assert.deepEqual(result, { succeeded: true, prospects: [], rejections: [] });
  assert.equal(existsSync(workspace), false);
});

test("the test suite blocks an uninjected network request", async () => {
  await assert.rejects(
    fetch("https://example.invalid"),
    /Network access is forbidden/,
  );
});
