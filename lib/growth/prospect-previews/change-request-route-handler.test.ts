import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createPreviewChangeRequestRouteHandler } from "./change-request-route-handler";

const PROSPECT_ID = "11111111-1111-4111-8111-111111111111";
const COMPOSITION_DIGEST = "a".repeat(64);

function request(body: unknown): Request {
  return new Request(
    `https://faithfulsoftware.dev/api/growth/prospects/${PROSPECT_ID}/preview/change-request`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://faithfulsoftware.dev",
      },
      body: JSON.stringify(body),
    },
  );
}

function context() {
  return { params: Promise.resolve({ id: PROSPECT_ID }) };
}

test("requires founder authentication before storing a preview change request", async () => {
  const handler = createPreviewChangeRequestRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    request({ compositionDigest: COMPOSITION_DIGEST, notes: "Use more local proof." }),
    context(),
  );

  assert.equal(response.status, 401);
});

test("rejects a missing source-package digest before creating a change request", async () => {
  let changeRequestCalls = 0;
  const handler = createPreviewChangeRequestRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    createPreviewChangeRequest: async () => {
      changeRequestCalls += 1;
      return { id: "22222222-2222-4222-8222-222222222222", generationPrNumber: 12 };
    },
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(request({ notes: "Use more local proof." }), context());

  assert.equal(response.status, 422);
  assert.equal(changeRequestCalls, 0);
});

test("stores founder feedback only against its selected source package", async () => {
  let input: unknown;
  const handler = createPreviewChangeRequestRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    createPreviewChangeRequest: async (received) => {
      input = received;
      return { id: "22222222-2222-4222-8222-222222222222", generationPrNumber: 12 };
    },
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    request({ compositionDigest: COMPOSITION_DIGEST, notes: "Use more local proof." }),
    context(),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(input, {
    prospectId: PROSPECT_ID,
    compositionDigest: COMPOSITION_DIGEST,
    notes: "Use more local proof.",
    createdBy: "a".repeat(64),
  });
  assert.deepEqual(await response.json(), {
    ok: true,
    correlationId: "correlation-id",
    id: "22222222-2222-4222-8222-222222222222",
    generationPrNumber: 12,
  });
});

test("returns not found when the selected source package is no longer reviewable", async () => {
  const handler = createPreviewChangeRequestRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    createPreviewChangeRequest: async () => null,
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    request({ compositionDigest: COMPOSITION_DIGEST, notes: "Use more local proof." }),
    context(),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "not_found",
    message: "The source package is no longer available for review.",
    correlationId: "correlation-id",
  });
});
