import assert from "node:assert/strict";
import test from "node:test";
import type { ResendMessage } from "@/lib/growth/integrations/resend/client";
import {
  OPERATIONS_EMAIL_ADDRESS,
  OPERATIONS_EMAIL_FROM,
} from "../email-identity";
import {
  deliverPortalInvitationEmail,
  sendPortalInvitationEmail,
} from "./invitation-email";

const email = {
  to: "client@example.test",
  activationUrl:
    "https://portal.example.test/activate?name=Client&__clerk_ticket=abc.def",
  idempotencyKey: `portal-invitation:${"a".repeat(64)}`,
};

test("the invitation email links straight to the activation page", async () => {
  const sent: ResendMessage[] = [];
  await sendPortalInvitationEmail(email, {
    send: async (message) => {
      sent.push(message);
      return { providerMessageId: "re_fixture" };
    },
  });
  assert.equal(sent.length, 1);
  const [message] = sent;
  assert.equal(message.category, "portal-invitation");
  assert.equal(message.from, OPERATIONS_EMAIL_FROM);
  assert.equal(message.replyTo, OPERATIONS_EMAIL_ADDRESS);
  assert.equal(message.to, "client@example.test");
  assert.equal(message.idempotencyKey, email.idempotencyKey);
  assert.match(
    message.html,
    /href="https:\/\/portal\.example\.test\/activate\?name=Client&amp;__clerk_ticket=abc\.def"/,
  );
  assert.ok(message.text.includes(email.activationUrl));
  assert.match(message.text, /older invitation emails/i);
  assert.doesNotMatch(message.html + message.text + message.subject, /—|!/);
});

test("the invitation email refuses a missing or malformed Operations Resend key", async () => {
  await assert.rejects(
    deliverPortalInvitationEmail(email, {}),
    /not configured/,
  );
  await assert.rejects(
    deliverPortalInvitationEmail(email, {
      OPERATIONS_RESEND_API_KEY: "sk_wrong",
    }),
    /not configured/,
  );
});

test("the HTML invitation keeps a copyable URL when links are disabled", async () => {
  const sent: ResendMessage[] = [];
  await sendPortalInvitationEmail(email, {
    send: async (message) => {
      sent.push(message);
      return { providerMessageId: "re_fixture" };
    },
  });

  const visibleText = sent[0].html
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&");
  assert.ok(visibleText.includes(email.activationUrl));
  assert.match(visibleText, /copy and paste this link into your browser/i);
});
