import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { GrowthDb } from "../db/types";

import { createSeoAuditReportRegenerationHandler } from "./regeneration-route-handler";

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
    "https://faithfulsoftware.dev/api/agent/seo-audits/regenerate-reports",
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
  regenerateReports: (input: {
    auditIds: readonly string[];
    correlationId: string;
  }) => Promise<number>,
) {
  return createSeoAuditReportRegenerationHandler({
    db: {} as GrowthDb,
    blobStorage: {
      putReport: async () => ({ url: "https://blob.example.test/audit.pdf" }),
      deleteReport: async () => undefined,
    },
    agentKeyId: "seo-audit-agent-v1",
    agentHmacSecret: secret,
    createCorrelationId: () => "correlation-1",
    now: () => now,
    reportUnexpectedError: () => assert.fail("Unexpected route error."),
    regenerateReports: (input) => regenerateReports(input),
  });
}

test("regenerates only signed draft audit IDs", async () => {
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
    regeneratedCount: 1,
  });
  assert.deepEqual(received, [auditId]);
});

test("rejects unsigned or duplicate report-regeneration requests", async () => {
  const unsigned = signedRequest({ auditIds: [auditId] });
  unsigned.headers.set("x-fss-signature", "0".repeat(64));
  assert.equal((await handler(async () => 1)(unsigned)).status, 401);

  assert.equal(
    (
      await handler(async () => 1)(
        signedRequest({ auditIds: [auditId, auditId] }),
      )
    ).status,
    422,
  );
});
