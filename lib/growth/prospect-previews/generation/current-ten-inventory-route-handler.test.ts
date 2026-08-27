import assert from "node:assert/strict";
import test from "node:test";

import type { AgentSignatureResult } from "../../integrations/agent-signature";
import { createCurrentTenPreviewInventoryPostHandler } from "./current-ten-inventory-route-handler";

const INVENTORY = {
  activeDrafts: 10,
  assessedDrafts: 10,
  pendingAssessedDrafts: 9,
  eligibleDrafts: 8,
};

function createHandler(input: {
  enabled: boolean;
  verifyResult?: AgentSignatureResult;
  onRun?: () => void;
}) {
  return createCurrentTenPreviewInventoryPostHandler({
    agentKeyId: "weekday-agent-v1",
    agentHmacSecret: "a".repeat(32),
    enabled: input.enabled,
    createCorrelationId: () => "correlation-id",
    now: () => new Date("2026-08-27T06:00:00.000Z"),
    verifyRequest: () => input.verifyResult ?? { ok: true },
    run: async () => {
      input.onRun?.();
      return INVENTORY;
    },
    reportUnexpectedError: () => undefined,
  });
}

test("rejects an unsigned current-ten inventory request before it reads the database", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: true,
    verifyResult: { ok: false, code: "missing" },
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-inventory", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 401);
  assert.equal(runCalls, 0);
});

test("returns aggregate current-ten selection counts after authentication", async () => {
  const handler = createHandler({ enabled: true });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-inventory", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "inventory",
    ...INVENTORY,
  });
});

test("does not read the database outside Production", async () => {
  let runCalls = 0;
  const handler = createHandler({
    enabled: false,
    onRun: () => {
      runCalls += 1;
    },
  });

  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-inventory", {
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "disabled",
    activeDrafts: 0,
    assessedDrafts: 0,
    pendingAssessedDrafts: 0,
    eligibleDrafts: 0,
  });
  assert.equal(runCalls, 0);
});
