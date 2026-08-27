import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSignatureResult } from "../../integrations/agent-signature";
import { createCurrentTenPreviewRetryPostHandler } from "./current-ten-retry-route-handler";

function createHandler(input: {
  enabled: boolean;
  verifyResult?: AgentSignatureResult;
  onRun?: () => void;
}) {
  return createCurrentTenPreviewRetryPostHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: "a".repeat(32),
    enabled: input.enabled,
    createCorrelationId: () => "correlation-id",
    now: () => new Date("2026-08-27T06:00:00.000Z"),
    verifyRequest: () => input.verifyResult ?? { ok: true },
    run: async () => {
      input.onRun?.();
      return { requeued: 2 };
    },
    reportUnexpectedError: () => undefined,
  });
}

test("rejects an unsigned current-ten retry before it runs", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    verifyResult: { ok: false, code: "missing" },
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request(
      "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-retry",
      {
        method: "POST",
      },
    ),
  );

  assert.equal(response.status, 401);
  assert.equal(runCalls, 0);
});

test("does not retry current-ten compositions outside Production", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: false,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request(
      "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-retry",
      {
        method: "POST",
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "disabled", requeued: 0 });
  assert.equal(runCalls, 0);
});

test("returns only the aggregate number of requeued current-ten compositions", async () => {
  const handler = createHandler({ enabled: true });

  const response = await handler(
    new Request(
      "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-retry",
      {
        method: "POST",
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "requeued", requeued: 2 });
});
