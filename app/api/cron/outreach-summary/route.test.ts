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
  GROWTH_OS_AUTOMATIONS_ENABLED: "true",
};

test("auth and default-off London gates prevent database and network access", async (t) => {
  const savedEnv = process.env,
    savedFetch = globalThis.fetch;
  try {
    process.env = source;
    globalThis.fetch = async () => {
      throw new Error("unexpected network");
    };
    t.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-03-29T16:30:00Z"),
    });
    const { GET } = await import("./route");
    const request = (authorized = true) =>
      new Request("https://example.test/api/cron/outreach-summary", {
        headers: authorized ? { authorization: `Bearer ${secret}` } : {},
      });
    assert.equal((await GET(request(false))).status, 401);
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outreach_summary_disabled",
    });
    process.env.GROWTH_OS_OUTREACH_SUMMARY_ENABLED = "yes";
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outreach_summary_disabled",
    });
    process.env.GROWTH_OS_OUTREACH_SUMMARY_ENABLED = "true";
    t.mock.timers.setTime(new Date("2026-03-29T17:30:00Z").getTime());
    assert.deepEqual(await (await GET(request())).json(), {
      ok: true,
      skipped: "outside_summary_slot",
    });
  } finally {
    t.mock.timers.reset();
    process.env = savedEnv;
    globalThis.fetch = savedFetch;
  }
});

test("manifest has one paired UTC summary slot", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile("vercel.json", "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  assert.deepEqual(
    manifest.crons.filter(
      (entry) => entry.path === "/api/cron/outreach-summary",
    ),
    [{ path: "/api/cron/outreach-summary", schedule: "30 16,17 * * *" }],
  );
});
