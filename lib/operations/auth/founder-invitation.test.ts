import assert from "node:assert/strict";
import test from "node:test";
import type { ResendMessage } from "@/lib/growth/integrations/resend/client";
import { sendFounderInvitation } from "./founder-invitation";

test("founder invitation is delivered only to the configured owner email", async () => {
  const sent: ResendMessage[] = [];
  await sendFounderInvitation(
    {
      ownerEmail: "founder@example.test",
      from: "FSS <access@example.test>",
      replyTo: "support@example.test",
    },
    "https://portal.example.test/portal",
    "approved self invitation",
    {
      async send(message) {
        sent.push(message);
        return { providerMessageId: "email_123" };
      },
    },
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "founder@example.test");
  assert.equal(sent[0]?.category, "founder-access");
  assert.match(sent[0]?.html ?? "", /https:\/\/portal\.example\.test\/portal/);
  assert.match(sent[0]?.text ?? "", /https:\/\/portal\.example\.test\/portal/);
  assert.doesNotMatch(sent[0]?.html ?? "", /approved self invitation/);
});

test("founder invitation requires the exact portal home path", async () => {
  await assert.rejects(
    sendFounderInvitation(
      {
        ownerEmail: "founder@example.test",
        from: "FSS <access@example.test>",
        replyTo: "support@example.test",
      },
      "https://example.test/growth/login",
      "approved",
      {
        async send() {
          return { providerMessageId: "must-not-send" };
        },
      },
    ),
  );
});
