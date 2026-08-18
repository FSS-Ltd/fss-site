import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import { createNeedsRedraftHandler } from "./needs-redraft-route-handler";
import { FirstEmailRedraftError } from "./redraft";

const routeOrigin = "https://example.test";
const context = { params: Promise.resolve({ id: "draft-id" }) };

function createRequest(
  body: unknown,
  origin: string | null = routeOrigin,
): Request {
  return new Request(
    `${routeOrigin}/api/growth/messages/draft-id/needs-redraft`,
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

const validBody = {
  expectedVersion: 1,
  reason: "The offer needs to reference their new service line.",
};

function createHandler(
  overrides: Partial<Parameters<typeof createNeedsRedraftHandler>[0]> = {},
) {
  return createNeedsRedraftHandler({
    db: {} as never,
    config: { origin: routeOrigin },
    authorizeFounder: async () => ({
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    }),
    requestRedraft: async (_db, input) => ({
      draftTaskId: input.draftTaskId,
      redraftTaskId: "redraft-task-id",
    }),
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}

test("sends a draft back for redraft with the founder's reason", async () => {
  let receivedInput: unknown;
  const handler = createHandler({
    requestRedraft: async (_db, input) => {
      receivedInput = input;
      return {
        draftTaskId: input.draftTaskId,
        redraftTaskId: "redraft-task-id",
      };
    },
  });

  const response = await handler(createRequest(validBody), context);
  const json = (await response.json()) as {
    ok: boolean;
    redraftTaskId: string;
  };

  assert.equal(response.status, 200);
  assert.equal(json.redraftTaskId, "redraft-task-id");
  assert.deepEqual(receivedInput, {
    draftTaskId: "draft-id",
    expectedVersion: 1,
    founder: {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    },
    correlationId: "correlation-id",
    reason: "The offer needs to reference their new service line.",
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

test("rejects a reason that is too short", async () => {
  const handler = createHandler();

  const response = await handler(
    createRequest({ expectedVersion: 1, reason: "too short" }),
    context,
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "invalid_body");
});

test("maps each redraft error code to its documented HTTP status", async () => {
  const cases: Array<[FirstEmailRedraftError["code"], number]> = [
    ["not_found", 404],
    ["not_redraftable", 409],
    ["version_conflict", 409],
    ["invalid_stored_draft", 422],
  ];

  for (const [code, status] of cases) {
    const handler = createHandler({
      requestRedraft: async () => {
        throw new FirstEmailRedraftError(code);
      },
    });
    const response = await handler(createRequest(validBody), context);
    assert.equal(
      response.status,
      status,
      `expected ${code} to map to ${status}`,
    );
  }
});
