import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Webhook } from "svix";
import { extractResendDeliveryCandidate } from "./outreach-delivery-evidence";
import { verifyResendWebhookSignature } from "./webhook";

const secret = Buffer.from("candidate-secret-for-resend-tests").toString(
  "base64",
);
const binding = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  team: "team-1",
  environment: "production" as const,
  sender: "sender@example.test",
  webhookGeneration: "22222222-2222-4222-8222-222222222222",
};
const eventId = "msg_signed_event_1";
function payload(): Record<string, unknown> {
  return {
    type: "email.delivered",
    created_at: "2026-11-23T12:00:00.000Z",
    data: {
      email_id: "provider_123",
      message_id: "<provider.123@example.test>",
      from: "FSS <sender@example.test>",
      to: ["owner@example.test"],
      created_at: "2026-11-23T11:59:00.000Z",
    },
  };
}
function extract(body: string, signed = true) {
  const date = new Date();
  const signature = new Webhook(secret).sign(eventId, date, body);
  const verified = verifyResendWebhookSignature(
    body,
    {
      "svix-id": eventId,
      "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": signed ? signature : "v1,bad",
    },
    secret,
  );
  return extractResendDeliveryCandidate({ verified, binding });
}

test("extracts bound delivery candidate from a verified exact event", () => {
  const body = JSON.stringify(payload());
  const candidate = extract(body);
  assert.equal(candidate?.providerEventId, eventId);
  assert.equal(
    candidate?.bodySha256,
    createHash("sha256").update(body).digest("hex"),
  );
  assert.equal(candidate?.connectionId, binding.connectionId);
  assert.equal(candidate?.providerMessageId, "provider_123");
  assert.equal(candidate?.rfcMessageId, "<provider.123@example.test>");
  assert.equal(candidate?.providerEventCreatedAt, "2026-11-23T12:00:00.000Z");
  assert.equal(candidate?.providerMessageCreatedAt, "2026-11-23T11:59:00.000Z");
  assert.equal(candidate?.recipient, "owner@example.test");
});

test("rejects unsigned, acceptance, malformed sender, references and recipients", () => {
  const base = payload();
  const data = base.data as Record<string, unknown>;
  const cases = [
    { ...base, type: "email.sent" },
    { ...base, data: { ...data, from: "other@example.test" } },
    {
      ...base,
      data: { ...data, from: "sender@example.test, other@example.test" },
    },
    {
      ...base,
      data: { ...data, to: ["owner@example.test", "other@example.test"] },
    },
    { ...base, data: { ...data, cc: ["other@example.test"] } },
    { ...base, data: { ...data, bcc: "other@example.test" } },
    {
      ...base,
      data: { ...data, message_id: "<one@example.test> <two@example.test>" },
    },
    { ...base, data: { ...data, message_id: "not-an-rfc-id" } },
    { ...base, data: { ...data, email_id: "" } },
    { ...base, created_at: "not-a-date" },
  ];
  assert.equal(extract(JSON.stringify(base), false), null);
  for (const value of cases) assert.equal(extract(JSON.stringify(value)), null);
});
