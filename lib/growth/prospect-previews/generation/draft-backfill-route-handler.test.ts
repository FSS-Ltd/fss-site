import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSignatureResult } from "../../integrations/agent-signature";
import { createCurrentTenDraftBackfillPostHandler } from "./draft-backfill-route-handler";

const BACKFILL_RESULT = {
  scanned: 10,
  created: 10,
  skipped: 0,
  invalid: 0,
};

function createHandler(input: {
  enabled: boolean;
  verifyResult?: AgentSignatureResult;
  onRun?: () => void;
}) {
  return createCurrentTenDraftBackfillPostHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: "a".repeat(32),
    enabled: input.enabled,
    createCorrelationId: () => "correlation-id",
    now: () => new Date("2026-08-27T06:00:00.000Z"),
    verifyRequest: () => input.verifyResult ?? { ok: true },
    run: async () => {
      input.onRun?.();
      return BACKFILL_RESULT;
    },
    reportUnexpectedError: () => undefined,
  });
}

test("rejects an unsigned draft-backfill trigger before it runs", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    verifyResult: { ok: false, code: "missing" },
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-drafts", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 401);
  assert.equal(runCalls, 0);
});

test("rejects a non-empty signed draft-backfill request before it runs", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-drafts", {
      method: "POST",
      body: "x",
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(runCalls, 0);
});

test("returns disabled after authentication without modifying drafts", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: false,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-drafts", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "disabled",
    scanned: 0,
    created: 0,
    skipped: 0,
    invalid: 0,
  });
  assert.equal(runCalls, 0);
});

test("returns aggregate draft-backfill counts for a valid signed request", async () => {
  const handler = createHandler({ enabled: true });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-drafts", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "backfilled",
    ...BACKFILL_RESULT,
  });
});
