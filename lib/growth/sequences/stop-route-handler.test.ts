import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import { createStopRouteHandler } from "./stop-route-handler";
import { SequenceStopError, type StopReason } from "./stop";

const routeOrigin = "https://example.test";
const context = { params: Promise.resolve({ id: "sequence-id" }) };

function createRequest(origin: string | null = routeOrigin): Request {
  return new Request(`${routeOrigin}/api/growth/sequences/sequence-id/pause`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin === null ? {} : { Origin: origin }),
    },
    body: JSON.stringify({}),
  });
}

function createHandler(
  reason: StopReason,
  overrides: Partial<Parameters<typeof createStopRouteHandler>[1]> = {},
) {
  return createStopRouteHandler(reason, {
    db: {} as never,
    config: { origin: routeOrigin },
    authorizeFounder: async () => ({
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    }),
    stopSequence: async (_db, input) => ({
      sequenceId: input.sequenceId,
      status: "stopped",
      alreadyApplied: false,
    }),
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}

test("stops the sequence with the route's own reason for the authorised founder", async () => {
  let receivedInput: unknown;
  const handler = createHandler("pause", {
    stopSequence: async (_db, input) => {
      receivedInput = input;
      return {
        sequenceId: input.sequenceId,
        status: "paused",
        alreadyApplied: false,
      };
    },
  });

  const response = await handler(createRequest(), context);
  const json = (await response.json()) as { ok: boolean; status: string };

  assert.equal(response.status, 200);
  assert.equal(json.status, "paused");
  assert.deepEqual(receivedInput, {
    sequenceId: "sequence-id",
    reason: "pause",
    actor: {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    },
    correlationId: "correlation-id",
  });
});

test("do-not-contact route stops the sequence with reason do_not_contact", async () => {
  let receivedInput: unknown;
  const handler = createHandler("do_not_contact", {
    stopSequence: async (_db, input) => {
      receivedInput = input;
      return {
        sequenceId: input.sequenceId,
        status: "stopped_opt_out",
        alreadyApplied: false,
      };
    },
  });

  await handler(createRequest(), context);

  assert.equal((receivedInput as { reason: string }).reason, "do_not_contact");
});

test("rejects a request from an unregistered origin", async () => {
  const handler = createHandler("rejected");

  const response = await handler(
    createRequest("https://attacker.test"),
    context,
  );

  assert.equal(response.status, 400);
});

test("rejects an unauthorised founder", async () => {
  const handler = createHandler("started_talks", {
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
  });

  const response = await handler(createRequest(), context);

  assert.equal(response.status, 401);
});

test("maps not_found and already_stopped to their documented HTTP status", async () => {
  const cases: Array<[SequenceStopError["code"], number]> = [
    ["not_found", 404],
    ["already_stopped", 409],
  ];

  for (const [code, status] of cases) {
    const handler = createHandler("pause", {
      stopSequence: async () => {
        throw new SequenceStopError(code);
      },
    });
    const response = await handler(createRequest(), context);
    assert.equal(
      response.status,
      status,
      `expected ${code} to map to ${status}`,
    );
    assert.equal((await response.json()).code, code);
  }
});
