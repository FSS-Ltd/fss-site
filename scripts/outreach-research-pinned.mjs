import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

const allowedEnv = new Set([
  "HOME",
  "NODE_ENV",
  "PATH",
  "CODEX_HOME",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
]);
const argumentNames = [
  "mode",
  "checkout",
  "revision",
  "node",
  "codex",
  "business-state",
  "facebook-state",
  "codex-home",
];

function fail() {
  throw new Error("invalid_launcher_configuration");
}
function privateDirectory(path) {
  if (!isAbsolute(path) || realpathSync(path) !== path) fail();
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    fail();
  return path;
}
function codexDirectory(path) {
  if (!isAbsolute(path) || realpathSync(path) !== path) fail();
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o022) !== 0 ||
    (process.getuid && stat.uid !== process.getuid())
  )
    fail();
  const auth = join(path, "auth.json");
  if (existsSync(auth)) {
    const file = lstatSync(auth);
    if (
      !file.isFile() ||
      file.isSymbolicLink() ||
      (file.mode & 0o077) !== 0 ||
      (process.getuid && file.uid !== process.getuid())
    )
      fail();
  }
  return path;
}
function inside(parent, child) {
  const suffix = relative(parent, child);
  return (
    suffix === "" ||
    (!suffix.startsWith("../") && suffix !== ".." && !isAbsolute(suffix))
  );
}
function parse(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--replay" && options.replay === undefined) {
      options.replay = true;
      continue;
    }
    const key = flag.startsWith("--") ? flag.slice(2) : "";
    const value = args[++i];
    if (!argumentNames.includes(key) || !value || options[key] !== undefined)
      fail();
    options[key] = value;
  }
  if (
    argumentNames.some((name) => typeof options[name] !== "string") ||
    !["business", "facebook"].includes(options.mode) ||
    !/^[0-9a-f]{40}$/.test(options.revision)
  )
    fail();
  return options;
}
function command(program, args, cwd, env) {
  return execFileSync(program, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  }).trim();
}
export function validateLauncher(
  args,
  env,
  sourceFile = fileURLToPath(import.meta.url),
  executable = process.execPath,
) {
  if (
    Object.keys(env).some((key) => !allowedEnv.has(key)) ||
    !env.HOME ||
    !isAbsolute(env.HOME) ||
    (env.NODE_ENV && env.NODE_ENV !== "production")
  )
    fail();
  const o = parse(args);
  if (
    !isAbsolute(o.checkout) ||
    realpathSync(o.checkout) !== o.checkout ||
    resolve(dirname(sourceFile), "..") !== o.checkout
  )
    fail();
  if (
    !isAbsolute(o.node) ||
    realpathSync(o.node) !== realpathSync(executable) ||
    !/^v24\./.test(process.version)
  )
    fail();
  if (
    !isAbsolute(o.codex) ||
    basename(o.codex) !== "codex" ||
    !isAbsolute(o["codex-home"]) ||
    (env.CODEX_HOME && env.CODEX_HOME !== o["codex-home"]) ||
    process.execArgv.length
  )
    fail();
  const nodeDir = dirname(o.node),
    codexDir = dirname(o.codex);
  if (
    existsSync(join(nodeDir, "codex")) &&
    realpathSync(join(nodeDir, "codex")) !== realpathSync(o.codex)
  )
    fail();
  const business = privateDirectory(o["business-state"]),
    facebook = privateDirectory(o["facebook-state"]),
    codexHome = codexDirectory(o["codex-home"]);
  if (
    inside(o.checkout, business) ||
    inside(o.checkout, facebook) ||
    inside(o.checkout, codexHome) ||
    inside(business, facebook) ||
    inside(facebook, business) ||
    inside(business, codexHome) ||
    inside(codexHome, business) ||
    inside(facebook, codexHome) ||
    inside(codexHome, facebook)
  )
    fail();
  const cleanEnv = {
    HOME: env.HOME,
    CODEX_HOME: codexHome,
    PATH: `${nodeDir}:${codexDir}:/usr/bin:/bin`,
    LANG: "C",
    NODE_ENV: "production",
  };
  const gitEnv = {
    HOME: env.HOME,
    PATH: "/usr/bin:/bin",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };
  const git = (...args) =>
    command(
      "/usr/bin/git",
      ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args],
      o.checkout,
      gitEnv,
    );
  if (
    git("rev-parse", "--show-toplevel") !== o.checkout ||
    git("rev-parse", "HEAD") !== o.revision ||
    git("status", "--porcelain=v1", "--untracked-files=all") !== "" ||
    git("ls-files", "-v")
      .split("\n")
      .some((entry) => /^[a-zS]/.test(entry))
  )
    fail();
  if (
    command(o.codex, ["--version"], o.checkout, cleanEnv) !==
    "codex-cli 0.163.0"
  )
    fail();
  return {
    mode: o.mode,
    checkout: o.checkout,
    state: o.mode === "business" ? business : facebook,
    replay: o.replay === true,
    node: o.node,
    env: cleanEnv,
  };
}
export function main(args = process.argv.slice(2), env = process.env) {
  let mode = "unknown";
  try {
    const plan = validateLauncher(args, env);
    mode = plan.mode;
    const result = spawnSync(
      plan.node,
      [
        "--import",
        "tsx",
        join(plan.checkout, "scripts/outreach-research-pinned-runner.ts"),
        plan.mode,
        plan.state,
        plan.replay ? "replay" : "new",
      ],
      { cwd: plan.checkout, env: plan.env, stdio: "ignore" },
    );
    const ok = !result.error && result.status === 0;
    process.stdout.write(
      `${JSON.stringify({ mode, status: ok ? "completed" : "failed" })}\n`,
    );
    return ok ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ mode, status: "rejected" })}\n`);
    return 1;
  }
}
if (
  process.argv[1] &&
  realpathSync(resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
)
  process.exitCode = main();
