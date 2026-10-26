import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import { createMessageReviewHandler } from "./message-review-route";

const id = "11111111-1111-4111-8111-111111111111";
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const founder = { email: "founder@example.test", actorId: "founder" };

test("rejects unauthenticated review reads before loading draft data", async () => {
  let loaded = false;
  const handler = createMessageReviewHandler({
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    loadReview: async () => {
      loaded = true;
      return { status: "unavailable", reason: "Missing" };
    },
    createCorrelationId: () => "review-test",
    reportUnexpectedError: () => {},
  });
  const response = await handler(
    new Request("https://example.test"),
    context(),
  );
  assert.equal(response.status, 401);
  assert.equal(loaded, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("validates IDs and returns current review data without caching", async () => {
  let loads = 0;
  const handler = createMessageReviewHandler({
    authorizeFounder: async () => founder,
    loadReview: async (draftId) => {
      loads++;
      assert.equal(draftId, id);
      return { status: "unavailable", reason: "Already reviewed" };
    },
    createCorrelationId: () => "review-test",
    reportUnexpectedError: () => {},
  });
  assert.equal(
    (await handler(new Request("https://example.test"), context("invalid")))
      .status,
    422,
  );
  assert.equal(loads, 0);
  const response = await handler(
    new Request("https://example.test"),
    context(),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    status: "unavailable",
    reason: "Already reviewed",
  });
  assert.equal(loads, 1);
});

test("contains unexpected failures without leaking details", async () => {
  const reports: unknown[] = [];
  const handler = createMessageReviewHandler({
    authorizeFounder: async () => founder,
    loadReview: async () => {
      throw new Error("private database details");
    },
    createCorrelationId: () => "review-test",
    reportUnexpectedError: (report) => {
      reports.push(report);
    },
  });
  const response = await handler(
    new Request("https://example.test"),
    context(),
  );
  assert.equal(response.status, 500);
  assert.doesNotMatch(
    JSON.stringify(await response.json()),
    /private database/,
  );
  assert.equal(reports.length, 1);
});
