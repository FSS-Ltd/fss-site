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
