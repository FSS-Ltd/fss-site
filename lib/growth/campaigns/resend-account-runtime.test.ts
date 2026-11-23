import assert from "node:assert/strict";
import test from "node:test";
import { readResendOutreachRuntime } from "./resend-account-runtime";

test("requires both separately configured credentials and generation bindings", () => {
  const env = {
    RESEND_OUTREACH_TEAM: "team-1",
    RESEND_OUTREACH_ENVIRONMENT: "production",
    RESEND_OUTREACH_FROM_EMAIL: "sender@example.test",
    RESEND_OUTREACH_REPLY_TO_EMAIL: "owner@example.test",
    RESEND_OUTREACH_SEND_GENERATION: "22222222-2222-4222-8222-222222222222",
    RESEND_OUTREACH_USAGE_GENERATION: "33333333-3333-4333-8333-333333333333",
    RESEND_OUTREACH_SEND_API_KEY: "send-secret",
    RESEND_OUTREACH_USAGE_API_KEY: "usage-secret",
  };
  const configured = readResendOutreachRuntime(env);
  assert.equal(configured?.binding.domain, "example.test");
  assert.equal(configured?.sendCredential, "send-secret");
  assert.equal(
    readResendOutreachRuntime({
      ...env,
      RESEND_OUTREACH_USAGE_API_KEY: undefined,
    }),
    null,
  );
  assert.equal(
    readResendOutreachRuntime({
      ...env,
      RESEND_OUTREACH_SEND_GENERATION: "not-a-generation",
    }),
    null,
  );
});
