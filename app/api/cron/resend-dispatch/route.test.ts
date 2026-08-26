import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "@/lib/growth/db/types";
import type { NewsletterDispatchSummary } from "@/lib/growth/newsletter/dispatch";

import { createResendDispatchRouteHandler } from "./handler";

const CRON_SECRET = "cron-secret-value";
const db = {} as GrowthDb;

const EMPTY_SUMMARY: NewsletterDispatchSummary = {
  seededIssues: 0,
  claimed: 0,
  sent: 0,
  cancelled: 0,
  retryableFailures: 0,
  permanentFailures: 0,
};

function request(headers: Record<string, string> = {}): Request {
  return new Request(
    "https://faithfulsoftwaresolutions.co.uk/api/cron/resend-dispatch",
    {
      headers,
    },
  );
}

test("rejects a request with no authorization header", async () => {
  const handler = createResendDispatchRouteHandler({
    db,
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    dispatch: async () => EMPTY_SUMMARY,
  });

  const response = await handler(request());

  assert.equal(response.status, 401);
});

test("rejects a request with the wrong secret", async () => {
  const handler = createResendDispatchRouteHandler({
    db,
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    dispatch: async () => EMPTY_SUMMARY,
  });

  const response = await handler(
    request({ authorization: "Bearer wrong-secret" }),
  );

  assert.equal(response.status, 401);
});

test("no-ops without dispatching when automations are disabled", async () => {
  let dispatchCalls = 0;
  const handler = createResendDispatchRouteHandler({
    db,
    cronSecret: CRON_SECRET,
    automationsEnabled: false,
    dispatch: async () => {
      dispatchCalls += 1;
      return EMPTY_SUMMARY;
    },
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.skipped, "automations_disabled");
  assert.equal(dispatchCalls, 0);
});

test("dispatches and returns counts only when authorized and enabled", async () => {
  const summary: NewsletterDispatchSummary = {
    seededIssues: 1,
    claimed: 3,
    sent: 2,
    cancelled: 1,
    retryableFailures: 0,
    permanentFailures: 0,
  };
  const handler = createResendDispatchRouteHandler({
    db,
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    dispatch: async () => summary,
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.dispatch, summary);
});

test("reports a 500 and calls the error reporter when dispatch throws", async () => {
  const reported: unknown[] = [];
  const handler = createResendDispatchRouteHandler({
    db,
    cronSecret: CRON_SECRET,
    automationsEnabled: true,
    dispatch: async () => {
      throw new Error("boom");
    },
    reportUnexpectedError: (error) => reported.push(error),
  });

  const response = await handler(
    request({ authorization: `Bearer ${CRON_SECRET}` }),
  );

  assert.equal(response.status, 500);
  assert.equal(reported.length, 1);
});
