import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createJourneyCommandHandler } from "./http";
import { JourneyConflict } from "./command-types";
const org = randomUUID();
function request(origin = "https://fss.test", body = "{}") {
  return new Request("https://fss.test/journey", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}
test("HTTP gates, authenticated founder, registered origin and private errors", async () => {
  let called = 0;
  const deps = {
    enabled: true,
    origin: "https://fss.test",
    authorize: async () => ({ actorId: "founder" }),
    createCorrelationId: randomUUID,
    reportUnexpectedError: () => {},
    execute: async () => {
      called++;
      return { journeyId: org };
    },
  };
  assert.equal(
    (
      await createJourneyCommandHandler({ ...deps, enabled: false })(
        request(),
        org,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await createJourneyCommandHandler({
        ...deps,
        authorize: async () => null,
      })(request(), org)
    ).status,
    401,
  );
  assert.equal(
    (await createJourneyCommandHandler(deps)(request("https://evil.test"), org))
      .status,
    403,
  );
  assert.equal(called, 0);
  const response = await createJourneyCommandHandler({
    ...deps,
    execute: async () => {
      throw new JourneyConflict("stale_preview", "Prepare again.");
    },
  })(request(), org);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "stale_preview");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(
    (
      await createJourneyCommandHandler(deps)(
        request("https://fss.test", "{"),
        org,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await createJourneyCommandHandler({
        ...deps,
        execute: async () => {
          throw new Error("private provider details");
        },
      })(request(), org)
    ).status,
    503,
  );
});
