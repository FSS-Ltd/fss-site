import assert from "node:assert/strict";
import test from "node:test";

/**
 * HTTP-level contract checks against a live Vercel preview deployment.
 * Skips entirely (not just individual cases) unless GROWTH_OS_PREVIEW_URL
 * is set — this file makes real network requests to a real deployment and
 * must never run unattended in ordinary CI.
 *
 * Scope: only checks that are safe to automate — rejection paths, public
 * page availability, and header/status contracts that have no side
 * effect on live provider or database state. The plan's own Task 6 Step 4
 * splits verification between "HTTP-level scripts and provider consoles"
 * — the side-effecting half (an accepted signed research fixture, a
 * founder-controlled Gmail sandbox send, a Resend test send, exact
 * database migration version, real webhook replay idempotency) is
 * deliberately left to docs/runbooks/growth-os-preview-checklist.md as
 * manual/console steps, not automated here, so that setting
 * GROWTH_OS_PREVIEW_URL can never accidentally trigger a real send.
 */

const previewUrl = process.env.GROWTH_OS_PREVIEW_URL;
const cronSecret = process.env.GROWTH_OS_PREVIEW_CRON_SECRET;

function url(pathname: string): string {
  return new URL(pathname, previewUrl).toString();
}

test(
  "public homepage is reachable over HTTPS",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/"));
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).protocol, "https:");
  },
);

test(
  "the founder dashboard redirects an unauthenticated visitor rather than serving data",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/growth"), { redirect: "manual" });
    assert.ok(
      response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 401,
      `expected a redirect or 401, got ${response.status}`,
    );
  },
);

test(
  "the health route requires a founder session",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/api/growth/health"));
    assert.equal(response.status, 401);
  },
);

test(
  "every cron route rejects a request with no authorization header",
  { skip: !previewUrl },
  async () => {
    for (const path of [
      "/api/cron/gmail-sync",
      "/api/cron/outreach-dispatch",
      "/api/cron/resend-dispatch",
      "/api/cron/maintenance",
    ]) {
      const response = await fetch(url(path));
      assert.equal(response.status, 401, `${path} should require authorization`);
    }
  },
);

test(
  "cron routes report automations disabled with the correct secret",
  { skip: !previewUrl || !cronSecret },
  async () => {
    const response = await fetch(url("/api/cron/maintenance"), {
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.skipped, "automations_disabled");
  },
);

test(
  "signed research ingestion rejects a request with no signature",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/api/agent/research-runs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  },
);

test(
  "signed research ingestion rejects a request with a bad signature",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/api/agent/research-runs"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fss-key-id": "weekday-agent-v1",
        "x-fss-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-fss-signature": "0".repeat(64),
      },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401);
  },
);

test(
  "the Resend webhook rejects a request with a bad signature",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/api/webhooks/resend"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": "msg_preview-contract-check",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,invalid",
      },
      body: JSON.stringify({ type: "email.sent", data: {} }),
    });
    assert.equal(response.status, 401);
  },
);

test(
  "the sitemap is reachable over HTTPS with a cache header",
  { skip: !previewUrl },
  async () => {
    const response = await fetch(url("/sitemap.xml"));
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).protocol, "https:");
    assert.ok(response.headers.get("cache-control"));
  },
);
