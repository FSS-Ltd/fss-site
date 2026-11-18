import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { createFacebookDiscoveryHandler } from "./discovery-route-handler";
import { verifyAgentRequest } from "../integrations/agent-signature";

const now = new Date("2026-11-18T00:00:00Z");
const timestamp = String(now.getTime() / 1000);
const secret = "test-secret";
function request(body: string): Request {
  return new Request("https://example.test/api/agent/facebook-discovery", {
    method: "POST",
    body,
    headers: {
      "x-fss-key-id": "agent",
      "x-fss-timestamp": timestamp,
      "x-fss-signature": createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex"),
    },
  });
}
test("authenticates exact bytes and only accepts discovery purpose", async () => {
  let received: unknown;
  const handler = createFacebookDiscoveryHandler({
    agentKeyId: "agent",
    agentHmacSecret: secret,
    now: () => now,
    createCorrelationId: () => "correlation",
    verifyRequest: verifyAgentRequest,
    ingest: async (batch, principal) => {
      received = { batch, principal };
      return { count: 0, alreadyExisted: false };
    },
    reportUnexpectedError: () => {},
  });
  const body = JSON.stringify(
    {
      version: 1,
      purpose: "facebook_public_discovery",
      externalRunId: "run",
      observedAt: now.toISOString(),
      observations: [],
    },
    null,
    2,
  );
  assert.equal((await handler(request(body))).status, 200);
  assert.deepEqual((received as { principal: unknown }).principal, {
    keyId: "agent",
    bodySha256: createHash("sha256").update(body).digest("hex"),
  });
  assert.equal(
    (
      await handler(
        request(body.replace("facebook_public_discovery", "wrong_purpose")),
      )
    ).status,
    422,
  );
});

test("rejects an oversized chunked body before authentication and cancels the stream", async () => {
  let cancelled = false;
  let verified = false;
  const handler = createFacebookDiscoveryHandler({
    agentKeyId: "agent",
    agentHmacSecret: secret,
    now: () => now,
    createCorrelationId: () => "correlation",
    verifyRequest: () => {
      verified = true;
      return { ok: true };
    },
    ingest: async () => {
      throw new Error("unexpected ingestion");
    },
    reportUnexpectedError: () => {},
  });
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(200000));
      controller.enqueue(new Uint8Array(70000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    body,
    duplex: "half",
  };
  assert.equal(
    (await handler(new Request("https://example.test", init))).status,
    413,
  );
  assert.equal(cancelled, true);
  assert.equal(verified, false);
});

test("rejects a forged signature before parsing", async () => {
  const handler = createFacebookDiscoveryHandler({
    agentKeyId: "agent",
    agentHmacSecret: secret,
    now: () => now,
    createCorrelationId: () => "correlation",
    verifyRequest: verifyAgentRequest,
    ingest: async () => {
      throw new Error("unexpected ingestion");
    },
    reportUnexpectedError: () => {},
  });
  const signed = request("not-json");
  signed.headers.set("x-fss-signature", "0".repeat(64));
  assert.equal((await handler(signed)).status, 401);
});
