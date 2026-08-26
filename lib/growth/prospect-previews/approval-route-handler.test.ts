import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createProspectPreviewApprovalRouteHandler } from "./approval-route-handler";

const PROSPECT_ID = "11111111-1111-4111-8111-111111111111";

function request(body: unknown): Request {
  return new Request(`https://faithfulsoftware.dev/api/growth/prospects/${PROSPECT_ID}/preview/approve`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://faithfulsoftware.dev" },
    body: JSON.stringify(body),
  });
}

function context() {
  return { params: Promise.resolve({ id: PROSPECT_ID }) };
}

test("requires founder authentication before preview approval", async () => {
  const handler = createProspectPreviewApprovalRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    request({ expectedProspectVersion: 3, expectedPreviewVersion: 1 }),
    context(),
  );

  assert.equal(response.status, 401);
});

test("requires both optimistic versions before preview approval", async () => {
  let approvalCalls = 0;
  const handler = createProspectPreviewApprovalRouteHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    approveProspectPreview: async () => {
      approvalCalls += 1;
      return {
        prospectId: PROSPECT_ID,
        publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
        status: "published",
        emailDraftVersion: 2,
      };
    },
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(request({ expectedProspectVersion: 3 }), context());

  assert.equal(response.status, 422);
  assert.equal(approvalCalls, 0);
});
