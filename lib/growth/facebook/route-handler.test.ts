import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { createFacebookCommandHandler } from "./route-handler";

test("rejects unauthorised Facebook commands", async () => {
  let called = false;
  const handler = createFacebookCommandHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => undefined,
    execute: async () => {
      called = true;
      return { id: "id", alreadyExisted: false };
    },
  });
  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/growth/facebook", {
      method: "POST",
      headers: {
        origin: "https://faithfulsoftware.dev",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("preserves duplicate prospect location on canonical source conflict", async () => {
  const { CrmError } = await import("../crm/errors");
  const id = "11111111-1111-4111-8111-111111111111";
  const handler = createFacebookCommandHandler({
    db: {} as GrowthDb,
    config: { origin: "https://faithfulsoftware.dev" },
    authorizeFounder: async () => ({
      email: "founder@example.test",
      actorId: "a".repeat(64),
    }),
    createCorrelationId: () => "correlation",
    reportUnexpectedError: () => undefined,
    execute: async () => {
      throw new CrmError("duplicate", id);
    },
  });
  const response = await handler(
    new Request("https://faithfulsoftware.dev/api/growth/facebook", {
      method: "POST",
      headers: {
        origin: "https://faithfulsoftware.dev",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "link_prospect",
        requestId: id,
        destinationId: id,
        prospectId: id,
      }),
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("location"), `/growth/prospects/${id}`);
});
