import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSignatureResult } from "../../integrations/agent-signature";
import { createProspectPreviewPrPostHandler } from "./route-handler";

const RUN_ID = "weekday-2026-08-27-0600-europe-london-v1";

function createHandler(input: {
  enabled: boolean;
  verifyResult?: AgentSignatureResult;
  isAllowedExternalRunId?: (externalRunId: string) => boolean;
  onRun?: () => void;
}) {
  return createProspectPreviewPrPostHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: "a".repeat(32),
    enabled: input.enabled,
    createCorrelationId: () => "correlation-id",
    now: () => new Date("2026-08-27T06:00:00.000Z"),
    verifyRequest: () => input.verifyResult ?? { ok: true },
    isAllowedExternalRunId: input.isAllowedExternalRunId,
    run: async (externalRunId) => {
      input.onRun?.();
      assert.equal(externalRunId, RUN_ID);
      return {
        externalRunId,
        status: "created" as const,
        generated: 10,
        unavailable: 0,
        pullRequestNumber: 412,
      };
    },
    reportUnexpectedError: () => undefined,
  });
}

test("rejects an unsigned preview-generation trigger before it runs", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    verifyResult: { ok: false, code: "missing" },
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/prospect-preview-prs", {
      method: "POST",
      body: JSON.stringify({ externalRunId: RUN_ID }),
    }),
  );

  assert.equal(response.status, 401);
  assert.equal(runCalls, 0);
});

test("rejects a signed trigger that is not allowed by the endpoint before it runs", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    isAllowedExternalRunId: () => false,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-pr", {
      method: "POST",
      body: JSON.stringify({ externalRunId: RUN_ID }),
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(runCalls, 0);
});

test("returns disabled after authentication without reading candidates or GitHub", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: false,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/prospect-preview-prs", {
      method: "POST",
      body: JSON.stringify({ externalRunId: RUN_ID }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    externalRunId: RUN_ID,
    status: "disabled",
    generated: 0,
    unavailable: 0,
    pullRequestNumber: null,
  });
  assert.equal(runCalls, 0);
});

test("returns a redacted pull request result for a valid signed trigger", async () => {
  const handler = createHandler({ enabled: true });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/prospect-preview-prs", {
      method: "POST",
      body: JSON.stringify({ externalRunId: RUN_ID }),
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    externalRunId: RUN_ID,
    status: "created",
    generated: 10,
    unavailable: 0,
    pullRequestNumber: 412,
  });
});
