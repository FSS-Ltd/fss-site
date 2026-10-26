import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { FounderAuthorizationError } from "../auth/require-founder";
import { createCrmCommandHandler } from "./route-handler";
const id = "cfdb8851-60ae-41c4-81cc-b1009593b421";
const founder = {
  email: "j.ntagengwa@faithfulsoftware.dev",
  actorId: "a".repeat(64),
};
const body = {
  kind: "add_activity",
  prospectId: id,
  requestId: "dfdb8851-60ae-41c4-81cc-b1009593b421",
  activityType: "note",
  body: "Met today",
};
function dependencies() {
  return {
    db: {} as GrowthDb,
    config: { origin: "https://growth.example.test" },
    authorizeFounder: async () => founder,
    createCorrelationId: () => id,
    reportUnexpectedError: () => {},
    execute: async () => ({ prospectId: id }),
  };
}
function request(value: unknown, origin = "https://growth.example.test") {
  return new Request("https://growth.example.test/api/growth/crm/" + id, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(value),
  });
}
test("CRM route rejects foreign origins, missing founder authority, invalid bodies and mismatched route identity", async () => {
  assert.equal(
    (
      await createCrmCommandHandler(dependencies())(
        request(body, "https://evil.test"),
        { params: Promise.resolve({ id }) },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await createCrmCommandHandler({
        ...dependencies(),
        authorizeFounder: async () => {
          throw new FounderAuthorizationError();
        },
      })(request(body), { params: Promise.resolve({ id }) })
    ).status,
    401,
  );
  assert.equal(
    (
      await createCrmCommandHandler(dependencies())(
        request({ ...body, body: "" }),
        { params: Promise.resolve({ id }) },
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await createCrmCommandHandler(dependencies())(request(body), {
        params: Promise.resolve({ id: body.requestId }),
      })
    ).status,
    422,
  );
});
test("CRM route returns committed command result with no-store response", async () => {
  const response = await createCrmCommandHandler(dependencies())(
    request(body),
    { params: Promise.resolve({ id }) },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).prospectId, id);
});
