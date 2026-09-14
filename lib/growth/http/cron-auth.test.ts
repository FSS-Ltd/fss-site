import assert from "node:assert/strict";
import test from "node:test";

import { authorizeCronRequest, createCronRouteHandler } from "./cron-auth";

const CRON_SECRET = "a".repeat(32);

function requestWithHeader(header: string | null): Request {
  return new Request("https://example.test/api/cron/gmail-sync", {
    headers: header === null ? undefined : { Authorization: header },
  });
}

test("rejects a request with no authorization header", () => {
  const result = authorizeCronRequest(requestWithHeader(null), CRON_SECRET);
  assert.deepEqual(result, { authorized: false, reason: "missing_header" });
});

test("rejects a request with the wrong bearer token", () => {
  const result = authorizeCronRequest(
    requestWithHeader("Bearer wrong-secret"),
    CRON_SECRET,
  );
  assert.deepEqual(result, { authorized: false, reason: "invalid_secret" });
});

test("accepts a request with the exact bearer token", () => {
  const result = authorizeCronRequest(
    requestWithHeader(`Bearer ${CRON_SECRET}`),
    CRON_SECRET,
  );
  assert.deepEqual(result, { authorized: true });
});

test("rejects a request using the wrong authorization scheme", () => {
  const result = authorizeCronRequest(
    requestWithHeader(`Basic ${CRON_SECRET}`),
    CRON_SECRET,
  );
  assert.deepEqual(result, { authorized: false, reason: "invalid_secret" });
});

test("fails closed when the server has no cron secret configured", () => {
  const withUndefined = authorizeCronRequest(
    requestWithHeader(`Bearer ${CRON_SECRET}`),
    undefined,
  );
  assert.deepEqual(withUndefined, {
    authorized: false,
    reason: "missing_secret",
  });

  const withBlank = authorizeCronRequest(
    requestWithHeader(`Bearer ${CRON_SECRET}`),
    "   ",
  );
  assert.deepEqual(withBlank, { authorized: false, reason: "missing_secret" });
});

test("route handler rejects an unauthorized request without doing any work", async () => {
  let workCalled = false;
  const handler = createCronRouteHandler(
    { cronSecret: CRON_SECRET, automationsEnabled: true },
    async () => {
      workCalled = true;
      return { processed: 1 };
    },
  );

  const response = await handler(requestWithHeader(null));

  assert.equal(response.status, 401);
  assert.equal(workCalled, false);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "missing_header",
  });
});

test("route handler skips work and returns 200 when automations are disabled", async () => {
  let workCalled = false;
  const handler = createCronRouteHandler(
    { cronSecret: CRON_SECRET, automationsEnabled: false },
    async () => {
      workCalled = true;
      return { processed: 1 };
    },
  );

  const response = await handler(requestWithHeader(`Bearer ${CRON_SECRET}`));

  assert.equal(response.status, 200);
  assert.equal(workCalled, false);
  assert.deepEqual(await response.json(), {
    ok: true,
    skipped: "automations_disabled",
  });
});

test("route handler reports and masks an unexpected error from the work function", async () => {
  const reported: Array<{ errorName: string; errorCode?: string }> = [];
  const handler = createCronRouteHandler(
    {
      cronSecret: CRON_SECRET,
      automationsEnabled: true,
      reportUnexpectedError: (error) => reported.push(error),
    },
    async () => {
      const error = new Error("Gmail token=secret must not reach logs.");
      error.stack = "stack containing provider response and credentials";
      throw error;
    },
  );

  const response = await handler(requestWithHeader(`Bearer ${CRON_SECRET}`));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "internal_error",
  });
  assert.deepEqual(reported, [{ errorName: "Error" }]);
  assert.doesNotMatch(JSON.stringify(reported), /token=secret|stack|credentials/);
});

test("route handler preserves an allowlisted provider error code", async () => {
  const reported: Array<{ errorName: string; errorCode?: string }> = [];
  const handler = createCronRouteHandler(
    {
      cronSecret: CRON_SECRET,
      automationsEnabled: true,
      reportUnexpectedError: (error) => reported.push(error),
    },
    async () => {
      const error = new Error("OAuth refresh token was rejected.");
      error.name = "GmailClientError";
      Object.assign(error, { code: "AUTHENTICATION_FAILED" });
      throw error;
    },
  );

  await handler(requestWithHeader(`Bearer ${CRON_SECRET}`));

  assert.deepEqual(reported, [
    { errorName: "GmailClientError", errorCode: "AUTHENTICATION_FAILED" },
  ]);
});

test("route handler rejects unsafe provider error codes", async () => {
  const reported: Array<{ errorName: string; errorCode?: string }> = [];
  const handler = createCronRouteHandler(
    {
      cronSecret: CRON_SECRET,
      automationsEnabled: true,
      reportUnexpectedError: (error) => reported.push(error),
    },
    async () => {
      const error = new Error("Provider response: recipient@example.test");
      Object.assign(error, { code: "recipient@example.test" });
      throw error;
    },
  );

  await handler(requestWithHeader(`Bearer ${CRON_SECRET}`));

  assert.deepEqual(reported, [{ errorName: "Error" }]);
});

test("route handler performs the work and returns its result when authorized and enabled", async () => {
  const handler = createCronRouteHandler(
    { cronSecret: CRON_SECRET, automationsEnabled: true },
    async () => ({ processed: 3, sent: 2 }),
  );

  const response = await handler(requestWithHeader(`Bearer ${CRON_SECRET}`));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, processed: 3, sent: 2 });
});
