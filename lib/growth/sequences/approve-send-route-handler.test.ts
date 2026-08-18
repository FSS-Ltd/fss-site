import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import { FirstEmailApprovalError } from "./approval";
import { createApproveSendHandler } from "./approve-send-route-handler";

const routeOrigin = "https://example.test";
const context = { params: Promise.resolve({ id: "draft-id" }) };

function createRequest(
  body: unknown,
  origin: string | null = routeOrigin,
): Request {
  return new Request(
    `${routeOrigin}/api/growth/messages/draft-id/approve-send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin === null ? {} : { Origin: origin }),
      },
      body: JSON.stringify(body),
    },
  );
}

const validBody = { expectedVersion: 1 };

function createHandler(
  overrides: Partial<Parameters<typeof createApproveSendHandler>[0]> = {},
) {
  return createApproveSendHandler({
    db: {} as never,
    config: { origin: routeOrigin },
    founderEmail: "j.ntagengwa@faithfulsoftware.dev",
    siteOrigin: routeOrigin,
    authorizeFounder: async () => ({
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    }),
    approveDraft: async (_db, input) => ({
      draftTaskId: input.draftTaskId,
      sequenceEnrollmentId: "enrollment-id",
      messageId: "message-id",
      status: "queued",
      rfcMessageId: "<growthos.message-id@faithfulsoftware.dev>",
    }),
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}

test("queues an approved draft for the authorised founder", async () => {
  let receivedInput: unknown;
  const handler = createHandler({
    approveDraft: async (_db, input) => {
      receivedInput = input;
      return {
        draftTaskId: input.draftTaskId,
        sequenceEnrollmentId: "enrollment-id",
        messageId: "message-id",
        status: "queued",
        rfcMessageId: "<growthos.message-id@faithfulsoftware.dev>",
      };
    },
  });

  const response = await handler(createRequest(validBody), context);
  const json = (await response.json()) as { ok: boolean; status: string };

  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.status, "queued");
  assert.deepEqual(receivedInput, {
    draftTaskId: "draft-id",
    expectedVersion: 1,
    founder: {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    },
    correlationId: "correlation-id",
    sendMode: "queue",
  });
});

test("rejects a request from an unregistered origin", async () => {
  const handler = createHandler();

  const response = await handler(
    createRequest(validBody, "https://attacker.test"),
    context,
  );

  assert.equal(response.status, 400);
});

test("rejects an unauthorised founder", async () => {
  const handler = createHandler({
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
  });

  const response = await handler(createRequest(validBody), context);

  assert.equal(response.status, 401);
});

test("maps each approval error code to its documented HTTP status", async () => {
  const cases: Array<[FirstEmailApprovalError["code"], number]> = [
    ["not_found", 404],
    ["not_approvable", 409],
    ["version_conflict", 409],
    ["suppressed_contact", 422],
    ["non_corporate_contact", 422],
    ["unapproved_visual", 422],
    ["invalid_stored_draft", 422],
    ["gmail_draft_failed", 502],
  ];

  for (const [code, status] of cases) {
    const handler = createHandler({
      approveDraft: async () => {
        throw new FirstEmailApprovalError(code);
      },
    });
    const response = await handler(createRequest(validBody), context);
    assert.equal(
      response.status,
      status,
      `expected ${code} to map to ${status}`,
    );
    assert.equal((await response.json()).code, code);
  }
});
