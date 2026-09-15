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
        ? new Response(null, { status: 401 })
        : Response.json({ active: false, onboardingRequired: true });
    },
    async (milliseconds) => {
      pauses.push(milliseconds);
    },
  );

  assert.equal(destination, "/portal/onboarding");
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
