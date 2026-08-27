import assert from "node:assert/strict";
import test from "node:test";

import { createProspectPreviewReconciliationRouteHandler } from "./handler";

const CRON_SECRET = "cron-secret-value";

function request(headers: Record<string, string> = {}): Request {
  return new Request(
    "https://faithfulsoftware.dev/api/cron/prospect-preview-reconciliation",
    { headers },
  );
}

test("rejects unauthenticated reconciliation requests", async () => {
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    previewPrEnabled: true,
    reconcile: async () => ({ merged: 0, waiting: 0, closed: 0, invalid: 0 }),
  });

  const response = await handler(request());

  assert.equal(response.status, 401);
});

test("does not call GitHub or the database when automations are disabled", async () => {
  let reconciliationCalls = 0;
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: false,
    previewPrEnabled: true,
    reconcile: async () => {
      reconciliationCalls += 1;
      return { merged: 0, waiting: 0, closed: 0, invalid: 0 };
    },
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    skipped: "automations_disabled",
  });
  assert.equal(reconciliationCalls, 0);
});

test("does not call GitHub or the database when preview PR generation is disabled", async () => {
  let reconciliationCalls = 0;
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    previewPrEnabled: false,
    reconcile: async () => {
      reconciliationCalls += 1;
      return { merged: 0, waiting: 0, closed: 0, invalid: 0 };
    },
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    skipped: "preview_pr_generation_disabled",
  });
  assert.equal(reconciliationCalls, 0);
});

test("returns only merge-state counts after an authorized reconciliation", async () => {
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    previewPrEnabled: true,
    reconcile: async () => ({ merged: 2, waiting: 3, closed: 1, invalid: 1 }),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    reconciliation: { merged: 2, waiting: 3, closed: 1, invalid: 1 },
  });
});

test("returns a redacted error response when reconciliation fails", async () => {
  const reported: unknown[] = [];
  const handler = createProspectPreviewReconciliationRouteHandler({
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    previewPrEnabled: true,
    reconcile: async () => {
      throw new Error("GitHub token must not escape");
    },
    reportUnexpectedError: (error) => reported.push(error),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, code: "internal_error" });
  assert.equal(reported.length, 1);
});
