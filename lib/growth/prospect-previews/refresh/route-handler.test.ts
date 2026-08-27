import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { verifyAgentRequest } from "../../integrations/agent-signature";
import {
  createProspectPreviewRefreshPostHandler,
  type ProspectPreviewRefreshRouteDependencies,
} from "./route-handler";

const NOW = new Date("2026-08-27T06:00:00.000Z");
const TIMESTAMP = String(NOW.getTime() / 1000);
const SECRET = "test-agent-hmac-secret-with-32-characters";
const KEY_ID = "weekday-agent-v1";
const PROSPECT_ID = "6322f2e9-a320-4e3c-8fbf-b2f137949e2c";

function createHandler(
  overrides: Partial<ProspectPreviewRefreshRouteDependencies> = {},
) {
  const calls: unknown[] = [];
  const handler = createProspectPreviewRefreshPostHandler({
    agentKeyId: KEY_ID,
    agentHmacSecret: SECRET,
    createCorrelationId: () => "corr-preview-refresh-1",
    now: () => NOW,
    verifyRequest: verifyAgentRequest,
    refresh: async (updates) => {
      calls.push(updates);
      return [{ prospectId: PROSPECT_ID, status: "refreshed" }];
    },
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
  return { handler, calls };
}

function createRequest(signature = true): Request {
  const body = JSON.stringify({ updates: [{ prospectId: PROSPECT_ID }] });
  const requestSignature = createHmac("sha256", SECRET)
    .update(TIMESTAMP)
    .update(".")
    .update(body)
    .digest("hex");
  return new Request("https://faithfulsoftware.dev/api/agent/prospect-preview-refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fss-key-id": KEY_ID,
      "x-fss-timestamp": TIMESTAMP,
      "x-fss-signature": signature ? requestSignature : "invalid",
    },
    body,
  });
}

test("returns only a redacted refresh count", async () => {
  const { handler, calls } = createHandler();

  const response = await handler(createRequest());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, refreshed: 1 });
  assert.deepEqual(calls, [[{ prospectId: PROSPECT_ID }]]);
});

test("rejects an unsigned refresh before it reaches the refresh service", async () => {
  const { handler, calls } = createHandler();

  const response = await handler(createRequest(false));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "unauthorized",
    message: "Request authentication failed.",
    correlationId: "corr-preview-refresh-1",
  });
  assert.deepEqual(calls, []);
});
