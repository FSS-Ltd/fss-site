import assert from "node:assert/strict";
import test from "node:test";
import { createResendOutreachTransport } from "./outreach-transport";

const body = JSON.stringify({
  from: "FSS <hello@example.test>",
  to: ["owner@example.test"],
  reply_to: "hello@example.test",
  subject: "A question for your business",
  html: "<p>Hello</p>",
  text: "Hello",
});
const input = { rawBody: body, idempotencyKey: "attempt-123" };

test("uses one guarded invocation and preserves exact committed bytes", async () => {
  let calls = 0;
  const transport = createResendOutreachTransport("test-key", {
    request: async (url, init) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(init?.body, body);
      assert.equal(init?.redirect, "error");
      assert.equal(
        new Headers(init?.headers).get("idempotency-key"),
        input.idempotencyKey,
      );
      return Response.json({ id: "provider-id" });
    },
  });
  assert.deepEqual(await transport.sendOnce(input, () => true), {
    status: "accepted",
    providerMessageId: "provider-id",
  });
  assert.equal(calls, 1);
});

test("gate failure and invalid payload never invoke provider", async () => {
  let calls = 0;
  const transport = createResendOutreachTransport("test-key", {
    request: async () => {
      calls++;
      return Response.json({ id: "x" });
    },
  });
  assert.equal(
    (await transport.sendOnce(input, () => false)).status,
    "not_invoked",
  );
  assert.equal(
    (
      await transport.sendOnce(
        {
          ...input,
          rawBody: JSON.stringify({
            ...JSON.parse(body),
            bcc: ["other@example.test"],
          }),
        },
        () => true,
      )
    ).status,
    "not_invoked",
  );
  assert.equal(
    (
      await transport.sendOnce(
        {
          ...input,
          rawBody: JSON.stringify({
            ...JSON.parse(body),
            headers: { Bcc: "other@example.test" },
          }),
        },
        () => true,
      )
    ).status,
    "not_invoked",
  );
  assert.equal(
    (
      await transport.sendOnce(input, () => {
        throw new Error("gate failed");
      })
    ).status,
    "not_invoked",
  );
  assert.equal(calls, 0);
});

test("uncertain provider failures never retry", async () => {
  for (const request of [
    async () => {
      throw new Error("secret");
    },
    async () => new Response("unavailable", { status: 503 }),
    async () => Response.json({ id: "" }),
    async () =>
      new Response("", {
        status: 302,
        headers: { location: "https://example.test" },
      }),
  ]) {
    let calls = 0;
    const transport = createResendOutreachTransport("test-key", {
      request: async () => {
        calls++;
        return request();
      },
    });
    assert.equal(
      (await transport.sendOnce(input, () => true)).status,
      "invoked_unknown",
    );
    assert.equal(calls, 1);
  }
});
