import assert from "node:assert/strict";
import test from "node:test";

const secret = "c".repeat(32);
const source = {
  NODE_ENV: "test" as const,
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fss_growth_test",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_AUTH_CLIENT_ID: "test",
  GOOGLE_AUTH_CLIENT_SECRET: "test",
  GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: secret,
  GROWTH_OS_AUTOMATIONS_ENABLED: "false",
};

test("cron rejects unauthorized requests and skips disabled automation before any provider work", async () => {
  const savedEnv = process.env;
  const savedFetch = globalThis.fetch;
  try {
    process.env = source;
    globalThis.fetch = async () => {
      throw new Error("unexpected network");
    };
    const { GET } = await import("./route");
    const denied = await GET(
      new Request("https://example.test/api/cron/outreach-prepare"),
    );
    assert.equal(denied.status, 401);
    const disabled = await GET(
      new Request("https://example.test/api/cron/outreach-prepare", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    );
    assert.deepEqual(await disabled.json(), {
      ok: true,
      skipped: "automations_disabled",
    });
  } finally {
    process.env = savedEnv;
    globalThis.fetch = savedFetch;
  }
});

test("rollout and London-time guards reject work before database or provider access", async (t) => {
  const savedEnv = process.env;
  const savedFetch = globalThis.fetch;
  try {
    process.env = { ...source, GROWTH_OS_AUTOMATIONS_ENABLED: "true" };
    globalThis.fetch = async () => {
      throw new Error("unexpected network");
    };
    t.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-03-29T07:30:00Z"),
    });
    const { GET } = await import("./route");
    const request = () =>
      new Request("https://example.test/api/cron/outreach-prepare", {
        headers: { authorization: `Bearer ${secret}` },
      });
    const inactive = await GET(request());
    assert.deepEqual(await inactive.json(), {
      ok: true,
      skipped: "outreach_preparation_disabled",
    });
    process.env.GROWTH_OS_OUTREACH_PREPARATION_ENABLED = "yes";
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outreach_preparation_disabled",
    });
    process.env.GROWTH_OS_OUTREACH_PREPARATION_ENABLED = "true";
    t.mock.timers.setTime(new Date("2026-03-29T08:30:00Z").getTime());
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outside_preparation_slot",
    });
    t.mock.timers.setTime(new Date("2026-03-29T07:29:59Z").getTime());
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outside_preparation_slot",
    });
  } finally {
    t.mock.timers.reset();
    process.env = savedEnv;
    globalThis.fetch = savedFetch;
  }
});

test("manifest preserves Operations cadences and adds one paired UTC preparation slot", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile("vercel.json", "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.deepEqual(
    manifest.crons.filter((item) => item.path === "/api/cron/outreach-prepare"),
    [{ path: "/api/cron/outreach-prepare", schedule: "30 7,8 * * *" }],
  );
  for (const name of [
    "operations-dispatch",
    "operations-signing",
    "operations-billing",
  ]) {
    assert.deepEqual(
      manifest.crons.filter((item) => item.path === `/api/cron/${name}`),
      [{ path: `/api/cron/${name}`, schedule: "*/5 * * * *" }],
    );
  }
});
