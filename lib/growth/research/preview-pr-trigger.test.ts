import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  triggerCurrentTenDraftPreviewBackfill,
  triggerCurrentTenPreviewPullRequest,
  triggerCurrentThirteenEvidenceRefresh,
  triggerScheduledPreviewPullRequest,
} from "./preview-pr-trigger";

const secret = "a".repeat(32);
const externalRunId = "weekday-2026-08-27-0600-europe-london-v1";
const now = new Date("2026-08-27T06:03:45.000Z");

test("signs a fixed, redacted preview-generation request from the parent scheduler", async () => {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const request = async (url: URL, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return Response.json({
      externalRunId,
      status: "created",
      generated: 10,
      unavailable: 0,
      pullRequestNumber: 412,
    });
  };

  const result = await triggerScheduledPreviewPullRequest({
    externalRunId,
    secret,
    now: () => now,
    request,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url.toString(),
    "https://faithfulsoftware.dev/api/agent/prospect-preview-prs",
  );
  assert.equal(calls[0]?.init.method, "POST");
  assert.equal(calls[0]?.init.body, JSON.stringify({ externalRunId }));

  const headers = calls[0]?.init.headers as Headers;
  const timestamp = "1787810625";
  assert.equal(headers.get("x-fss-key-id"), "weekday-agent-v1");
  assert.equal(headers.get("x-fss-timestamp"), timestamp);
  assert.equal(
    headers.get("x-fss-signature"),
    createHmac("sha256", secret)
      .update(timestamp)
      .update(".")
      .update(JSON.stringify({ externalRunId }))
      .digest("hex"),
  );
});

test("fails closed when the redacted preview-generation response is invalid", async () => {
  const result = await triggerScheduledPreviewPullRequest({
    externalRunId,
    secret,
    now: () => now,
    request: async () => Response.json({ externalRunId, prospects: ["private"] }),
  });

  assert.deepEqual(result, { ok: false });
});

test("targets the Production-only current-ten endpoint with a dated backfill identifier", async () => {
  const currentTenRunId = "current-ten-2026-08-27";
  const calls: Array<{ url: URL; init: RequestInit }> = [];

  const result = await triggerCurrentTenPreviewPullRequest({
    externalRunId: currentTenRunId,
    secret,
    now: () => now,
    request: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        externalRunId: currentTenRunId,
        status: "created",
        generated: 10,
        unavailable: 0,
        pullRequestNumber: 413,
      });
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url.toString(),
    "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-pr",
  );
  assert.equal(calls[0]?.init.body, JSON.stringify({ externalRunId: currentTenRunId }));
});

test("targets the Production-only thirteen-draft evidence refresh endpoint", async () => {
  const evidenceRefreshRunId = "evidence-refresh-thirteen-2026-08-27";
  const calls: Array<{ url: URL; init: RequestInit }> = [];

  const result = await triggerCurrentThirteenEvidenceRefresh({
    externalRunId: evidenceRefreshRunId,
    secret,
    now: () => now,
    request: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        externalRunId: evidenceRefreshRunId,
        status: "created",
        generated: 13,
        unavailable: 0,
        pullRequestNumber: 414,
      });
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(
    calls[0]?.url.toString(),
    "https://faithfulsoftware.dev/api/agent/current-thirteen-evidence-refresh-pr",
  );
  assert.equal(
    calls[0]?.init.body,
    JSON.stringify({ externalRunId: evidenceRefreshRunId }),
  );
});

test("targets the Production-only historical draft-backfill endpoint with an empty signed body", async () => {
  const calls: Array<{ url: URL; init: RequestInit }> = [];

  const result = await triggerCurrentTenDraftPreviewBackfill({
    secret,
    now: () => now,
    request: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        status: "backfilled",
        scanned: 10,
        created: 10,
        skipped: 0,
        invalid: 0,
      });
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url.toString(),
    "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-drafts",
  );
  assert.equal(calls[0]?.init.method, "POST");
  assert.equal(calls[0]?.init.body, undefined);

  const headers = calls[0]?.init.headers as Headers;
  assert.equal(headers.get("x-fss-key-id"), "weekday-agent-v1");
  assert.equal(headers.get("x-fss-timestamp"), "1787810625");
  assert.equal(
    headers.get("x-fss-signature"),
    createHmac("sha256", secret)
      .update("1787810625")
      .update(".")
      .digest("hex"),
  );
});

test("fails closed when the historical draft-backfill endpoint is disabled", async () => {
  const result = await triggerCurrentTenDraftPreviewBackfill({
    secret,
    now: () => now,
    request: async () =>
      Response.json({
        status: "disabled",
        scanned: 0,
        created: 0,
        skipped: 0,
        invalid: 0,
      }),
  });

  assert.deepEqual(result, { ok: false });
});

test("rejects a non-current-ten identifier without calling the Production endpoint", async () => {
  let calls = 0;

  await assert.rejects(
    triggerCurrentTenPreviewPullRequest({
      externalRunId,
      secret,
      now: () => now,
      request: async () => {
        calls += 1;
        return Response.json({});
      },
    }),
    /current-ten/i,
  );

  assert.equal(calls, 0);
});

test("rejects an invalid run identifier without calling the application", async () => {
  let calls = 0;
  await assert.rejects(
    triggerScheduledPreviewPullRequest({
      externalRunId: "invalid run id",
      secret,
      now: () => now,
      request: async () => {
        calls += 1;
        return Response.json({});
      },
    }),
    /run ID/i,
  );
  assert.equal(calls, 0);
});
