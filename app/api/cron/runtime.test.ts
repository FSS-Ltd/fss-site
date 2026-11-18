import assert from "node:assert/strict";
import test from "node:test";
import { parseGrowthServerEnv } from "../../../lib/growth/config/env";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { encryptRefreshToken } from "../../../lib/growth/integrations/token-crypto";
import { createCronGmailClient } from "./runtime";

const key = Buffer.alloc(32, 7);
const source = {
  DATABASE_URL: "postgresql://app:secret@example.test:6543/postgres",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_AUTH_CLIENT_ID: "client-id",
  GOOGLE_AUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_GMAIL_CLIENT_ID: "gmail-id",
  GOOGLE_GMAIL_CLIENT_SECRET: "gmail-secret",
  GOOGLE_GMAIL_REDIRECT_URI:
    "https://example.test/api/integrations/gmail/callback",
  GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  TOKEN_ENCRYPTION_KEY: key.toString("base64"),
  CRON_SECRET: "c".repeat(32),
  GROWTH_OS_AUTOMATIONS_ENABLED: "false",
};

test("cron Gmail client carries the identity from its credential row", async () => {
  const token = encryptRefreshToken("synthetic-token", { version: "v1", key });
  const db = (async () => [
    {
      connectionId: "account",
      googleSubject: "subject",
      grantEpoch: 3,
      grantedScopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      encryptedRefreshToken: JSON.stringify(token),
      encryptionKeyVersion: "v1",
    },
  ]) as unknown as GrowthDb;
  const result = await createCronGmailClient(db, parseGrowthServerEnv(source));
  assert.equal(result.binding.connectionId, "account");
  assert.equal(result.binding.grantEpoch, 3);
  assert.equal(typeof result.client.listHistory, "function");
});

test("both cron routes stay disabled without provider work", async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, source);
    const gmail = await import("./gmail-sync/route");
    const outreach = await import("./outreach-dispatch/route");
    for (const route of [gmail, outreach]) {
      const response = await route.GET(
        new Request("https://example.test/api/cron", {
          headers: { authorization: `Bearer ${source.CRON_SECRET}` },
        }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        ok: true,
        skipped: "automations_disabled",
      });
    }
  } finally {
    process.env = saved;
  }
});
