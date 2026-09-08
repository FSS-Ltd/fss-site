import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";
test("exported onboarding webhook rejects disabled and unsigned traffic before database access", async () => {
  const names = [
    "OPERATIONS_ENABLED",
    "OPERATIONS_ONBOARDING_ENABLED",
    "OPERATIONS_RESEND_WEBHOOK_SECRET",
    "OPERATIONS_RESEND_ACCOUNT_SCOPE",
  ];
  const original = new Map(names.map((name) => [name, process.env[name]]));
  try {
    process.env.OPERATIONS_ENABLED = "false";
    const request = () =>
      new Request("https://example.test/api/webhooks/operations/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    assert.equal((await POST(request())).status, 404);
    process.env.OPERATIONS_ENABLED = "true";
    process.env.OPERATIONS_ONBOARDING_ENABLED = "true";
    process.env.OPERATIONS_RESEND_WEBHOOK_SECRET = `whsec_${Buffer.alloc(32).toString("base64")}`;
    process.env.OPERATIONS_RESEND_ACCOUNT_SCOPE = "synthetic";
    assert.equal((await POST(request())).status, 400);
  } finally {
    for (const [name, value] of original)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});
