import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildFacebookRunId,
  runFacebookDiscovery,
  researchPublicDestinations,
} from "./scheduled-discovery";

test("uses London calendar date in winter and summer", () => {
  assert.equal(
    buildFacebookRunId(new Date("2026-01-01T23:30:00Z")),
    "facebook-2026-01-01-0730-europe-london-v1",
  );
  assert.equal(
    buildFacebookRunId(new Date("2026-06-01T23:30:00Z")),
    "facebook-2026-06-02-0730-europe-london-v1",
  );
});

test("submits an empty successful search and replays exact bytes after ambiguity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    let research = 0;
    const bodies: string[] = [];
    const secret = "s".repeat(32);
    const request: typeof fetch = async (_url, options) => {
      const body = String(options?.body);
      bodies.push(body);
      const headers = new Headers(options?.headers);
      assert.equal(
        headers.get("x-fss-signature"),
        createHmac("sha256", secret)
          .update(`${headers.get("x-fss-timestamp")}.${body}`)
          .digest("hex"),
      );
      assert.equal(options?.redirect, "error");
      if (bodies.length <= 3) throw new Error("private data");
      return Response.json({ count: 0, alreadyExisted: true });
    };
    const input = {
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      research: () => {
        research++;
        return { succeeded: true, observations: [] };
      },
      secret: () => secret,
      request,
      wait: async () => {},
    };
    assert.equal((await runFacebookDiscovery(input)).ok, false);
    const result = await runFacebookDiscovery(input);
    assert.deepEqual(result, {
      ok: true,
      count: 0,
      alreadyExisted: true,
      attempts: 1,
    });
    assert.equal(research, 1);
    assert.equal(new Set(bodies).size, 1);
    assert.equal(JSON.parse(bodies[0]).purpose, "facebook_public_discovery");
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          join(dir, `${buildFacebookRunId(input.now)}.receipt.json`),
          "utf8",
        ),
      ),
      { count: 0, alreadyExisted: true },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects failed or invalid research before accessing credentials", async () => {
  const dir = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    let credentials = 0;
    const base = {
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      secret: () => {
        credentials++;
        return "s".repeat(32);
      },
    };
    assert.equal(
      (
        await runFacebookDiscovery({
          ...base,
          research: () => ({ succeeded: false, observations: [] }),
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await runFacebookDiscovery({
          ...base,
          research: () => ({
            succeeded: true,
            observations: [{ url: "http://bad" }],
          }),
        })
      ).ok,
      false,
    );
    assert.equal(credentials, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects inconsistent responses without disclosing response content", async () => {
  const dir = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    const result = await runFacebookDiscovery({
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      research: () => ({ succeeded: true, observations: [] }),
      secret: () => "s".repeat(32),
      request: async () =>
        Response.json({ count: 1, alreadyExisted: false, private: "secret" }),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "invalid_response",
      httpStatus: 200,
      attempts: 1,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("retries transient HTTP failures with the same valid evidence bytes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    const bodies: string[] = [];
    const waits: number[] = [];
    const result = await runFacebookDiscovery({
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      research: () => ({
        succeeded: true,
        observations: [
          {
            url: "https://www.facebook.com/groups/example",
            name: "Example",
            kind: "group",
            locality: "Kent",
            websiteUrl: null,
            observation: {
              sourceUrl: "https://www.facebook.com/groups/example",
              summary: "Public activity",
              observedAt: "2026-01-01T07:00:00Z",
            },
          },
        ],
      }),
      secret: () => "s".repeat(32),
      request: async (_url, options) => {
        bodies.push(String(options?.body));
        return bodies.length === 1
          ? new Response(null, { status: 503 })
          : Response.json({ count: 1, alreadyExisted: false });
      },
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    assert.deepEqual(result, {
      ok: true,
      count: 1,
      alreadyExisted: false,
      attempts: 2,
    });
    assert.deepEqual(waits, [30000]);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(JSON.parse(bodies[0]).observations.length, 1);
    assert.equal(JSON.stringify(result).includes("Example"), false);
    const receipt = await runFacebookDiscovery({
      now: new Date("2026-01-01T09:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      secret: () => {
        throw new Error("must not load");
      },
    });
    assert.deepEqual(receipt, {
      ok: true,
      count: 1,
      alreadyExisted: false,
      attempts: 0,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("does not retry permanent HTTP errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    const result = await runFacebookDiscovery({
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: dir,
      research: () => ({ succeeded: true, observations: [] }),
      secret: () => "s".repeat(32),
      request: async () => new Response("private", { status: 409 }),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "http_error",
      httpStatus: 409,
      attempts: 1,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("refuses a symlinked state directory before research or credentials", async () => {
  const parent = mkdtempSync(join(tmpdir(), "facebook-test-"));
  try {
    const link = join(parent, "link");
    symlinkSync(parent, link);
    const result = await runFacebookDiscovery({
      now: new Date("2026-01-01T08:00:00Z"),
      repositoryRoot: process.cwd(),
      stateDirectory: link,
      research: () => {
        throw new Error("must not run");
      },
      secret: () => {
        throw new Error("must not run");
      },
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "local_setup_failed",
      httpStatus: null,
      attempts: 0,
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("runs bounded child research with a private output schema and cleans up", () => {
  let outputPath = "";
  const result = researchPublicDestinations(
    process.cwd(),
    (command, args, cwd) => {
      assert.equal(command, "codex");
      assert.equal(cwd, process.cwd());
      assert.ok(args.includes("--search"));
      assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
      const schemaPath = args[args.indexOf("--output-schema") + 1];
      outputPath = args[args.indexOf("--output-last-message") + 1];
      const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
      assert.equal(schema.properties.observations.maxItems, 10);
      assert.match(args.at(-1) ?? "", /at most ten public searches/);
      writeFileSync(
        outputPath,
        JSON.stringify({ succeeded: true, observations: [] }),
      );
      return true;
    },
  );
  assert.deepEqual(result, { succeeded: true, observations: [] });
  assert.throws(() => readFileSync(outputPath));
});
