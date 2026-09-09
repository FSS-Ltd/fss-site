import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

const keys = [
  "OPERATIONS_ENABLED",
  "OPERATIONS_SUPABASE_URL",
  "OPERATIONS_SUPABASE_PUBLISHABLE_KEY",
  "OPERATIONS_PORTAL_DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
] as const;

test("service enquiry route fails closed before identity or database access", async () => {
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.OPERATIONS_ENABLED = "false";
    let response = await POST(
      new Request("https://example.test/api/portal/services/enquiries", {
        method: "POST",
      }),
    );
    assert.equal(response.status, 404);
    Object.assign(process.env, {
      OPERATIONS_ENABLED: "true",
      OPERATIONS_SUPABASE_URL: "https://auth.example.test",
      OPERATIONS_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      OPERATIONS_PORTAL_DATABASE_URL: "postgres://unused",
      NEXT_PUBLIC_SITE_URL: "https://example.test",
    });
    response = await POST(
      new Request("https://example.test/api/portal/services/enquiries", {
        method: "POST",
        headers: {
          Origin: "https://attacker.test",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
