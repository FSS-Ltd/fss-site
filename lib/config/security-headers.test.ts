import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../../next.config";

test("enforces the site content security policy and permits Growth OS Blob assets", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  if (typeof nextConfig.headers !== "function") return;

  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === "/(.*)");
  const csp = globalRule?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  );

  assert.ok(csp);
  assert.match(csp.value, /frame-ancestors 'none'/);
  assert.match(csp.value, /https:\/\/\*\.public\.blob\.vercel-storage\.com/);
  assert.equal(
    globalRule?.headers.some(
      (header) => header.key === "Content-Security-Policy-Report-Only",
    ),
    false,
  );
});

test("permits Clerk to initialize and complete its protected authentication flows", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  if (typeof nextConfig.headers !== "function") return;

  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === "/(.*)");
  const csp = globalRule?.headers.find(
    (header) => header.key === "Content-Security-Policy",
  );

  assert.ok(csp);
  assert.match(
    csp.value,
    /script-src[^;]*https:\/\/clerk\.faithfulsoftware\.dev/,
  );
  assert.match(
    csp.value,
    /connect-src[^;]*https:\/\/clerk\.faithfulsoftware\.dev/,
  );
  assert.match(
    csp.value,
    /connect-src[^;]*https:\/\/\*\.protect\.clerk\.com:\*/,
  );
  assert.match(
    csp.value,
    /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/,
  );
  assert.match(csp.value, /frame-src[^;]*https:\/\/\*\.protect\.clerk\.com/);
  assert.match(csp.value, /img-src[^;]*https:\/\/img\.clerk\.com/);
  assert.match(csp.value, /worker-src[^;]*'self' blob:/);
});
