import assert from "node:assert/strict";
import test from "node:test";
import { resolvePortalClaimDestination } from "./portal-claim-destination";

test("accepted accounts continue to organisation onboarding when no tenant exists", () => {
  assert.equal(
    resolvePortalClaimDestination({
      active: false,
      onboardingRequired: true,
    }),
    "/onboarding",
  );
  assert.equal(resolvePortalClaimDestination({ active: true }), "/");
  assert.equal(
    resolvePortalClaimDestination({ active: true, destination: "admin" }),
    "/admin",
  );
  assert.throws(() => resolvePortalClaimDestination({ active: false }));
});
