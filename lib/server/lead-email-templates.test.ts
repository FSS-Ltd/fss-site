import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

// "server-only" throws outside the Next.js server build, so resolve it to an empty module.
const require = createRequire(import.meta.url);
const Module = require("node:module") as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const resolve = Module._resolveFilename;
Module._resolveFilename = (request, ...rest) =>
  request === "server-only"
    ? fileURLToPath(import.meta.url)
    : resolve(request, ...rest);

test("notification email escapes visitor HTML before newline conversion", async () => {
  const { buildInternalLeadNotificationEmail } =
    await import("./lead-email-templates");
  const { html } = buildInternalLeadNotificationEmail({
    siteUrl: "https://example.test",
    payload: {
      firstName: "<script>alert(1)</script>",
      lastName: '"><img src=x onerror=alert(1)>',
      workEmail: "a@example.test",
      company: "<b>Co</b>",
      challenge:
        'Need: x\nDetail: <script>x</script>\r\nBcc: evil@example.test"><svg onload=1>',
      sourceContext: "contact",
      sourcePath: "/contact",
      submissionId: "00000000-0000-4000-8000-000000000000",
    },
  });
  assert.doesNotMatch(html, /<script|<img|<svg|<b>Co/i);
  assert.match(html, /Need: x<br>Detail: scriptx\/script/);
  assert.equal((html.match(/<br>/g) ?? []).length, 2);
});
