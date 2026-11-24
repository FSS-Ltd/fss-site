import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "svix";
import { classifyResendOutreachAdverse } from "./outreach-adverse-evidence";
import { verifyResendWebhookSignature } from "./webhook";

const secret = Buffer.from("synthetic-adverse-event-secret").toString("base64");
const binding = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  team: "team",
  environment: "production" as const,
  sender: "sender@example.test",
  webhookGeneration: "22222222-2222-4222-8222-222222222222",
};
const event = {
  type: "email.bounced",
  created_at: "2026-11-23T12:00:00.000Z",
  data: {
    email_id: "provider-1",
    message_id: "<actual@example.test>",
    from: "sender@example.test",
    to: ["owner@example.test"],
    bounce: { type: "Permanent" },
  },
};
function classify(payload: unknown) {
  const raw = JSON.stringify(payload),
    now = new Date(),
    id = "event-id";
  const verified = verifyResendWebhookSignature(
    raw,
    {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
      "svix-signature": new Webhook(secret).sign(id, now, raw),
    },
    secret,
  );
  return classifyResendOutreachAdverse(verified, binding);
}
test("classifies only permanent bounces and complaints for suppression", () => {
  assert.equal(classify(event).kind, "adverse");
  assert.equal(
    classify({ ...event, type: "email.complained" }).kind,
    "adverse",
  );
  for (const type of ["Transient", "Undetermined", "unknown"])
    assert.equal(
      classify({ ...event, data: { ...event.data, bounce: { type } } }).kind,
      "ignored",
    );
  assert.equal(
    classify({ ...event, data: { ...event.data, bounce: undefined } }).kind,
    "ignored",
  );
  assert.equal(
    classify({
      ...event,
      data: { ...event.data, to: ["a@example.test", "b@example.test"] },
    }).kind,
    "invalid",
  );
  assert.equal(
    classify({ ...event, data: { ...event.data, from: "other@example.test" } })
      .kind,
    "invalid",
  );
  assert.equal(
    classify({
      ...event,
      data: { ...event.data, message_id: "not-a-message-id" },
    }).kind,
    "invalid",
  );
  assert.equal(
    classifyResendOutreachAdverse({ ok: false }, binding).kind,
    "invalid",
  );
});
