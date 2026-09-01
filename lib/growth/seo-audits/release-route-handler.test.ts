import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { GrowthDb } from "../db/types";

import { createSeoAuditClaimReleaseHandler } from "./release-route-handler";

const secret = "a-secure-test-secret-that-is-longer-than-thirty-two-characters";
const now = new Date("2026-09-01T06:30:00.000Z");
const auditId = "11111111-1111-4111-8111-111111111111";

function signedRequest(body: unknown): Request {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(now.getTime() / 1_000));
  const signature = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
  return new Request(
    "https://faithfulsoftware.dev/api/agent/seo-audits/release",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fss-key-id": "seo-audit-agent-v1",
        "x-fss-timestamp": timestamp,
        "x-fss-signature": signature,
      },
      body: rawBody,
    },
  );
}

function handler(
  releaseClaims: (input: {
    auditIds: readonly string[];
    correlationId: string;
  }) => Promise<number>,
) {
  return createSeoAuditClaimReleaseHandler({
    db: {} as GrowthDb,
    agentKeyId: "seo-audit-agent-v1",
    agentHmacSecret: secret,
    createCorrelationId: () => "correlation-1",
    now: () => now,
    reportUnexpectedError: () => assert.fail("Unexpected route error."),
    releaseClaims: (input) => releaseClaims(input),
  });
}

test("releases only the signed audit IDs from an incomplete agent run", async () => {
  let received: readonly string[] = [];
  const response = await handler(async (input) => {
    received = input.auditIds;
    assert.equal(input.correlationId, "correlation-1");
    return 1;
  })(signedRequest({ auditIds: [auditId] }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    correlationId: "correlation-1",
    releasedCount: 1,
  });
  assert.deepEqual(received, [auditId]);
});

test("rejects an unsigned audit-release request", async () => {
  const request = signedRequest({ auditIds: [auditId] });
  request.headers.set("x-fss-signature", "0".repeat(64));

  const response = await handler(async () => 1)(request);
  assert.equal(response.status, 401);
});
