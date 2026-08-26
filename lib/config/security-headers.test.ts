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
