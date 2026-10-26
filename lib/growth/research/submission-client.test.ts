import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createGlobalResearchFixture } from "./global-test-fixture";
import { submitGlobalResearch } from "./submission-client";

const secret = "test-only-signing-key-not-a-production-secret";
const success = {
  ok: true,
  runId: "00000000-0000-4000-8000-000000000001",
  accepted: 1,
  duplicates: 0,
  rejected: 0,
  acceptedProspects: [
    { candidateIndex: 0, prospectId: "00000000-0000-4000-8000-000000000002" },
  ],
};

test("submission validates before making a request", async () => {
  const result = await submitGlobalResearch({
    rawBody: "{}",
    secret,
    request: async () => {
      throw new Error("Must not request");
    },
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "invalid_input",
    httpStatus: null,
    attempts: 0,
  });
});

test("submission rejects empty credentials before making a request", async () => {
  const result = await submitGlobalResearch({
    rawBody: JSON.stringify(createGlobalResearchFixture()),
    secret: "",
    request: async () => {
      throw new Error("Must not request");
    },
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "invalid_credential",
    httpStatus: null,
    attempts: 0,
  });
});

test("submission signs exact bytes and retries with fresh signatures on the same batch", async () => {
  const rawBody = JSON.stringify(createGlobalResearchFixture(), null, 2);
  const waits: number[] = [];
  let requests = 0;
  const result = await submitGlobalResearch({
    rawBody,
    secret,
    now: () => new Date(1_800_000_000_000 + requests * 30_000),
    wait: async (milliseconds) => {
      waits.push(milliseconds);
    },
    request: async (url, init) => {
      assert.equal(
        String(url),
        "https://faithfulsoftware.dev/api/agent/research-runs",
      );
      assert.equal(init?.body, rawBody);
      assert.equal(init?.redirect, "error");
      const headers = new Headers(init?.headers);
      const stamp = String(1_800_000_000 + requests * 30);
      assert.equal(headers.get("X-FSS-Timestamp"), stamp);
      assert.equal(
        headers.get("X-FSS-Signature"),
        createHmac("sha256", secret)
          .update(`${stamp}.${rawBody}`)
          .digest("hex"),
      );
      requests += 1;
      return requests < 3
        ? new Response(null, { status: 503 })
        : Response.json(success);
    },
  });
  assert.deepEqual(waits, [30_000, 120_000]);
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
});

test("submission does not retry authentication or validation failures", async () => {
  for (const httpStatus of [400, 401, 413, 422]) {
    const result = await submitGlobalResearch({
      rawBody: JSON.stringify(createGlobalResearchFixture()),
      secret,
      request: async () => new Response(null, { status: httpStatus }),
      wait: async () => {
        assert.fail("Must not retry");
      },
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "http_error",
      httpStatus,
      attempts: 1,
    });
  }
});

test("submission caps uncertain transport retries without exposing errors", async () => {
  let calls = 0;
  const result = await submitGlobalResearch({
    rawBody: JSON.stringify(createGlobalResearchFixture()),
    secret,
    request: async () => {
      calls += 1;
      throw new Error("private request contents");
    },
    wait: async () => {},
  });
  assert.equal(calls, 3);
  assert.deepEqual(result, {
    ok: false,
    reason: "transport_error",
    httpStatus: null,
    attempts: 3,
  });
});

test("submission rejects inconsistent counts or candidate mapping without blind retries", async () => {
  for (const result of [
    { ...success, accepted: 2 },
    { ...success, rejected: 1 },
    {
      ...success,
      acceptedProspects: [
        { ...success.acceptedProspects[0], candidateIndex: 1 },
      ],
    },
  ]) {
    const report = await submitGlobalResearch({
      rawBody: JSON.stringify(createGlobalResearchFixture()),
      secret,
      request: async () => Response.json(result),
      wait: async () => {
        assert.fail("Must not retry");
      },
    });
    assert.deepEqual(report, {
      ok: false,
      reason: "invalid_response",
      httpStatus: 200,
      attempts: 1,
    });
  }
});
