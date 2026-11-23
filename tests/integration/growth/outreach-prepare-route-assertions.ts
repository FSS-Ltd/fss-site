import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GrowthDb } from "../../../lib/growth/db/types";
import { encryptRefreshToken } from "../../../lib/growth/integrations/token-crypto";
const run = promisify(execFile);

export async function exerciseOutreachPrepareRoute(
  admin: GrowthDb,
  db: GrowthDb,
  input: { id: string; email: string; url: string },
): Promise<void> {
  const target = new URL(input.url);
  assert.equal(target.hostname, "127.0.0.1");
  assert.ok(["55488", "55489"].includes(target.port));
  assert.equal(target.pathname, "/fss_growth_test");
  const [role] = await db<{ role: string }[]>`select current_user as role`;
  assert.equal(role?.role, "growth_app");
  const [before] = await admin<
    { cursor: string | null; token: string | null; keyVersion: string | null }[]
  >`select provider_cursor as cursor,encrypted_refresh_token as token,encryption_key_version as "keyVersion" from growth.integration_connections where id=${input.id}`;
  assert.ok(before);
  const [existing] = await admin<
    { count: number }[]
  >`select count(*)::int as count from growth.gmail_reply_coverage where connection_id=${input.id}`;
  assert.equal(existing?.count, 0);
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptRefreshToken("synthetic-token", {
    version: "v1",
    key,
  });
  const url = new URL(input.url);
  url.searchParams.set("options", "-c role=growth_app");
  await admin`create temporary table due_test_usage as select * from growth.outreach_provider_usage where connection_id=${input.id}`;
  try {
    await admin`update growth.integration_connections set encrypted_refresh_token=${JSON.stringify(encrypted)},encryption_key_version='v1' where id=${input.id}`;
    const env = {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: process.env.HOME ?? "/tmp",
      NODE_ENV: "test" as const,
      DATABASE_URL: url.toString(),
      AUTH_SECRET: "a".repeat(32),
      GOOGLE_AUTH_CLIENT_ID: "test",
      GOOGLE_AUTH_CLIENT_SECRET: "test",
      GOOGLE_GMAIL_CLIENT_ID: "test",
      GOOGLE_GMAIL_CLIENT_SECRET: "test",
      GOOGLE_GMAIL_REDIRECT_URI:
        "http://localhost/api/integrations/gmail/callback",
      GROWTH_OS_OWNER_EMAIL: input.email,
      TOKEN_ENCRYPTION_KEY: key.toString("base64"),
      CRON_SECRET: "c".repeat(32),
      GROWTH_OS_AUTOMATIONS_ENABLED: "true",
      GROWTH_OS_OUTREACH_PREPARATION_ENABLED: "true",
    };
    for (const mode of ["complete", "held"]) {
      await run(
        process.execPath,
        [
          "--import",
          "tsx",
          "tests/integration/growth/outreach-prepare-route-child.ts",
        ],
        { env: { ...env, PREP_TEST_MODE: mode }, timeout: 20000 },
      );
    }
  } finally {
    await admin`delete from growth.gmail_reply_coverage where connection_id=${input.id}`;
    await admin`update growth.integration_connections set provider_cursor=${before.cursor},encrypted_refresh_token=${before.token},encryption_key_version=${before.keyVersion} where id=${input.id}`;
    await admin`delete from growth.outreach_provider_usage where connection_id=${input.id}`;
    await admin`insert into growth.outreach_provider_usage select * from due_test_usage`;
    await admin`drop table due_test_usage`;
  }
}
