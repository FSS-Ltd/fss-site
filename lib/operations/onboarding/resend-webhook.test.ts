import assert from "node:assert/strict";
import test from "node:test";
import { Webhook } from "svix";
import { createOnboardingWebhookHandler } from "./resend-webhook";
const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;
const event = {
  type: "email.bounced",
  data: {
    email_id: "email-1",
    from: "service@example.test",
    to: ["signer@example.test"],
    tags: { operations_job: "11111111-1111-4111-8111-111111111111" },
  },
};
function request(payload: unknown = event, valid = true): Request {
  const body = JSON.stringify(payload),
    date = new Date(),
    id = "msg_test";
  const signature = new Webhook(secret).sign(id, date, body);
  return new Request("https://example.test/api/webhooks/operations/resend", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": valid ? signature : "invalid",
    },
  });
}
test("onboarding webhook verifies exact signed bytes, ignores unrelated mail, and bounds body", async () => {
  let records = 0;
  const handler = createOnboardingWebhookHandler({
    enabled: true,
    configuration: () => ({ secret, accountScope: "test-account" }),
    record: async (account, id, payload) => {
      records++;
      assert.equal(account, "test-account");
      assert.equal(id, "msg_test");
      assert.deepEqual(payload, event);
    },
  });
  assert.equal((await handler(request())).status, 200);
  assert.equal(records, 1);
  assert.equal((await handler(request(event, false))).status, 400);
  assert.equal(records, 1);
  assert.equal((await handler(request({ type: "email.sent" }))).status, 200);
  assert.equal(records, 1);
  assert.equal(
    (await handler(request({ ...event, data: { ...event.data, tags: {} } })))
      .status,
    200,
  );
  assert.equal(records, 1);
  assert.equal(
    (
      await handler(
        new Request("https://example.test", { method: "POST", body: "{}" }),
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await handler(
        new Request("https://example.test", {
          method: "POST",
          body: "x".repeat(65537),
          headers: { "content-type": "application/json" },
        }),
      )
    ).status,
    413,
  );
  const offline = createOnboardingWebhookHandler({
    enabled: false,
    configuration: () => {
      throw Error();
    },
    record: async () => {
      throw Error();
    },
  });
  assert.equal((await offline(request())).status, 404);
  const failure = createOnboardingWebhookHandler({
    enabled: true,
    configuration: () => ({ secret, accountScope: "test" }),
    record: async () => {
      throw Error("private provider details");
    },
  });
  const response = await failure(request());
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private"), false);
});
