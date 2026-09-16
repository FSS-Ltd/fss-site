import assert from "node:assert/strict";
import test from "node:test";
import { claimPortalAccess } from "./portal-claim-request";

test("retries a claim while Clerk finishes exposing the new session", async () => {
  let requests = 0;
  const pauses: number[] = [];

  const destination = await claimPortalAccess(
    async () => {
      requests += 1;
      return requests === 1
        ? Response.json(
            { active: false, outcome: "session_pending" },
            { status: 401 },
          )
        : Response.json({ active: false, onboardingRequired: true });
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  );

  assert.equal(destination, "/onboarding");
  assert.equal(requests, 2);
  assert.deepEqual(pauses, [250]);
});

test("does not retry a non-authentication claim failure", async () => {
  let requests = 0;

  await assert.rejects(
    claimPortalAccess(async () => {
      requests += 1;
      return new Response(null, { status: 503 });
    }),
    /Portal access is not active yet/,
  );

  assert.equal(requests, 1);
});

test("does not retry a denied invitation and directs the user to request a new one", async () => {
  let requests = 0;

  await assert.rejects(
    claimPortalAccess(async () => {
      requests += 1;
      return Response.json(
        { active: false, outcome: "access_denied" },
        { status: 403 },
      );
    }),
    /invitation has expired or portal access is unavailable/i,
  );

  assert.equal(requests, 1);
});

test("reports a temporary portal outage without retrying an unavailable service", async () => {
  await assert.rejects(
    claimPortalAccess(async () =>
      Response.json({ active: false, outcome: "unavailable" }, { status: 503 }),
    ),
    /temporarily unavailable/i,
  );
});
