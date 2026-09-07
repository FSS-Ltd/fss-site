import assert from "node:assert/strict";
import test from "node:test";
import { createFounderRequestHandler } from "./founder-request-handler";
import { RequestConflict } from "../requests/types";
const id = "10000000-0000-4000-8000-000000000001";
const founder = { actorId: "synthetic@example.test" };
function request(
  origin = "https://fss.test",
  body: unknown = { action: "start", expectedVersion: 1 },
) {
  return new Request("https://fss.test/api/growth/operations", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("founder request controls authenticate and bind route identifiers before mutation", async () => {
  let called = 0;
  const handler = createFounderRequestHandler({
    enabled: true,
    origin: "https://fss.test",
    authorizeFounder: async () => founder,
    execute: async (actor, organisation, command) => {
      assert.equal(actor, founder);
      assert.equal(organisation, id);
      assert.deepEqual(command, {
        action: "start",
        expectedVersion: 1,
        requestId: id,
      });
      called++;
      return { id, version: 2 };
    },
    createCorrelationId: () => id,
    reportUnexpectedError: () => {},
  });
  assert.equal(
    (await handler(request("https://evil.test"), id, id)).status,
    403,
  );
  assert.equal(
    (await handler(request(undefined, { requestId: id }), id, id)).status,
    400,
  );
  const result = await handler(request(), id, id);
  assert.equal(result.status, 200);
  assert.equal(called, 1);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
});
test("founder denial, conflicts and dependency failures preserve private errors", async () => {
  for (const [kind, status] of [
    ["auth", 403],
    ["conflict", 409],
    ["database", 503],
  ] as const) {
    const handler = createFounderRequestHandler({
      enabled: true,
      origin: "https://fss.test",
      authorizeFounder: async () => {
        if (kind === "auth") throw new Error("denied");
        return founder;
      },
      execute: async () => {
        if (kind === "conflict") throw new RequestConflict();
        throw new Error("private database hostname");
      },
      createCorrelationId: () => id,
      reportUnexpectedError: () => {},
    });
    const response = await handler(request(), id, id);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private database hostname/);
  }
});
