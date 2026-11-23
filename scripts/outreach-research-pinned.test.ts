import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildFacebookRunId } from "../lib/growth/facebook/scheduled-discovery";
import {
  buildDailyResearchRunId,
  runDailyResearch,
} from "../lib/growth/research/daily-discovery";
import { runPinnedResearch } from "./outreach-research-pinned-runner";

const launcherSource = resolve("scripts/outreach-research-pinned.mjs");
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "fss-pinned-")));
  const checkout = join(root, "checkout"),
    business = join(root, "business"),
    facebook = join(root, "facebook"),
    codexHome = join(root, "codex-home"),
    bin = join(root, "bin");
  for (const path of [checkout, business, facebook, codexHome, bin])
    mkdirSync(path, { mode: 0o700 });
  mkdirSync(join(checkout, "scripts"));
  writeFileSync(
    join(checkout, "scripts/outreach-research-pinned.mjs"),
    readFileSync(launcherSource),
  );
  writeFileSync(
    join(checkout, "scripts/outreach-research-pinned-runner.ts"),
    `import { writeFileSync } from "node:fs"; writeFileSync(process.argv[3] + "/called", JSON.stringify({mode: process.argv[2], operation: process.argv[4], secret: process.env.TEST_SECRET ?? null}));`,
  );
  writeFileSync(join(checkout, ".gitignore"), "node_modules\n");
  symlinkSync(resolve("node_modules"), join(checkout, "node_modules"));
  const codex = join(bin, "codex");
  writeFileSync(codex, "#!/bin/sh\nprintf 'codex-cli 0.163.0\\n'\n", {
    mode: 0o700,
  });
  const git = (...args: string[]) =>
    execFileSync("/usr/bin/git", args, { cwd: checkout, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  git("add", ".");
  git("commit", "-qm", "fixture");
  const revision = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd: checkout,
    encoding: "utf8",
  }).trim();
  const args = [
    join(checkout, "scripts/outreach-research-pinned.mjs"),
    "--mode",
    "business",
    "--checkout",
    checkout,
    "--revision",
    revision,
    "--node",
    process.execPath,
    "--codex",
    codex,
    "--business-state",
    business,
    "--facebook-state",
    facebook,
    "--codex-home",
    codexHome,
  ];
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    HOME: process.env.HOME ?? root,
    PATH: "/usr/bin:/bin",
  };
  return { root, checkout, business, facebook, args, env, git };
}
function invoke(args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, args, { env, encoding: "utf8" });
}
test("pins clean checkout and redacts output and child environment", () => {
  const f = fixture();
  try {
    chmodSync(join(f.root, "codex-home"), 0o755);
    const result = invoke(f.args, f.env);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      mode: "business",
      status: "completed",
    });
    assert.deepEqual(
      JSON.parse(readFileSync(join(f.business, "called"), "utf8")),
      { mode: "business", operation: "new", secret: null },
    );
    const facebookArgs = [...f.args];
    facebookArgs[facebookArgs.indexOf("--mode") + 1] = "facebook";
    assert.equal(invoke(facebookArgs, f.env).status, 0);
    assert.equal(
      JSON.parse(readFileSync(join(f.facebook, "called"), "utf8")).mode,
      "facebook",
    );
    const replay = invoke([...f.args, "--replay"], f.env);
    assert.equal(replay.status, 0);
    assert.equal(
      JSON.parse(readFileSync(join(f.business, "called"), "utf8")).operation,
      "replay",
    );
    chmodSync(join(f.root, "codex-home"), 0o775);
    assert.equal(invoke(f.args, f.env).status, 1);
    chmodSync(join(f.root, "codex-home"), 0o755);
    writeFileSync(join(f.root, "codex-home", "auth.json"), "{}", {
      mode: 0o644,
    });
    assert.equal(invoke(f.args, f.env).status, 1);
    chmodSync(join(f.root, "codex-home", "auth.json"), 0o600);
    const withSecret = invoke(f.args, {
      ...f.env,
      TEST_SECRET: "must-not-pass",
    });
    assert.equal(withSecret.status, 1);
    assert.ok(!withSecret.stdout.includes("must-not-pass"));
    assert.equal(
      invoke(f.args, { ...f.env, NODE_OPTIONS: "--trace-warnings" }).status,
      1,
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("rejects wrong revision, tracked and staged dirt, and in-checkout or shared private state", () => {
  const f = fixture();
  try {
    const wrong = [...f.args];
    wrong[wrong.indexOf("--revision") + 1] = "0".repeat(40);
    assert.equal(invoke(wrong, f.env).status, 1);
    writeFileSync(join(f.checkout, ".gitignore"), "changed\n");
    assert.equal(invoke(f.args, f.env).status, 1);
    f.git("add", ".gitignore");
    assert.equal(invoke(f.args, f.env).status, 1);
    f.git("reset", "--hard", "-q", "HEAD");
    f.git("update-index", "--assume-unchanged", ".gitignore");
    writeFileSync(join(f.checkout, ".gitignore"), "hidden-change\n");
    assert.equal(invoke(f.args, f.env).status, 1);
    f.git("update-index", "--no-assume-unchanged", ".gitignore");
    f.git("reset", "--hard", "-q", "HEAD");
    chmodSync(f.facebook, 0o755);
    assert.equal(invoke(f.args, f.env).status, 1);
    chmodSync(f.facebook, 0o700);
    const shared = [...f.args];
    shared[shared.indexOf("--facebook-state") + 1] = f.business;
    assert.equal(invoke(shared, f.env).status, 1);
    const privateInside = join(f.checkout, "private");
    mkdirSync(privateInside, { mode: 0o700 });
    const inside = [...f.args];
    inside[inside.indexOf("--business-state") + 1] = privateInside;
    assert.equal(invoke(inside, f.env).status, 1);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
test("real Facebook replay consumes a cached receipt without credentials or HTTP", () => {
  const state = mkdtempSync(join(tmpdir(), "fss-replay-"));
  try {
    writeFileSync(
      join(state, `${buildFacebookRunId(new Date())}.receipt.json`),
      JSON.stringify({ count: 0, alreadyExisted: false }),
      { mode: 0o600 },
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("scripts/outreach-research-pinned-runner.ts"),
        "facebook",
        state,
        "replay",
      ],
      {
        cwd: resolve("."),
        env: {
          NODE_ENV: "production",
          HOME: process.env.HOME ?? state,
          PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
        },
        stdio: "pipe",
      },
    );
    assert.equal(result.status, 0);
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("explicit replay requires existing state and normal mode resumes receipt", () => {
  const state = mkdtempSync(join(tmpdir(), "fss-replay-gate-"));
  const runner = resolve("scripts/outreach-research-pinned-runner.ts");
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    HOME: process.env.HOME ?? state,
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
  };
  try {
    assert.equal(
      spawnSync(
        process.execPath,
        ["--import", "tsx", runner, "facebook", state, "replay"],
        { env, stdio: "ignore" },
      ).status,
      1,
    );
    writeFileSync(
      join(state, `${buildFacebookRunId(new Date())}.receipt.json`),
      JSON.stringify({ count: 0, alreadyExisted: false }),
      { mode: 0o600 },
    );
    assert.equal(
      spawnSync(
        process.execPath,
        ["--import", "tsx", runner, "facebook", state, "new"],
        { env, stdio: "ignore" },
      ).status,
      0,
    );
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("normal business retry submits retained exact bytes without invoking search", async () => {
  const state = mkdtempSync(join(tmpdir(), "fss-business-replay-"));
  const now = new Date("2026-11-23T07:00:00Z");
  const runId = buildDailyResearchRunId(now);
  const path = join(state, `${runId}.json`);
  const body = JSON.stringify({
    schemaVersion: "2.0",
    externalRunId: runId,
    runDate: "2026-11-23",
    timezone: "Europe/London",
    promptVersion: "daily-research-v2",
    prospects: [],
    rejections: [],
    outcome: "no_results",
  });
  try {
    writeFileSync(path, body, { mode: 0o600 });
    let submissions = 0;
    const ports = {
      now,
      secret: () => "test-only-secret-at-least-thirty-two-characters",
      business: (input: Parameters<typeof runDailyResearch>[0]) =>
        runDailyResearch({
          ...input,
          submit: async ({ rawBody }) => {
            assert.equal(rawBody, body);
            submissions++;
            return {
              ok: true as const,
              result: {
                ok: true as const,
                runId: "00000000-0000-4000-8000-000000000001",
                accepted: 0,
                duplicates: 0,
                rejected: 0,
                acceptedProspects: [],
              },
              attempts: 1,
            };
          },
        }),
    };
    assert.equal(
      await runPinnedResearch(["business", state, "new"], ports),
      true,
    );
    assert.equal(
      await runPinnedResearch(["business", state, "replay"], ports),
      true,
    );
    assert.equal(submissions, 2);
    assert.equal(
      await runPinnedResearch(["business", state, "new"], {
        ...ports,
        business: (input) => {
          rmSync(path);
          return runDailyResearch(input);
        },
      }),
      false,
    );
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});
