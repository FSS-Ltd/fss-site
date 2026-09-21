import assert from "node:assert/strict";
import test from "node:test";
import { getPortalClaimDestinations } from "./portal-claim-destinations";

test("sends staff claims to the guarded portal when Studio is disabled", () => {
  assert.deepEqual(getPortalClaimDestinations(false, false), {
    admin: "/portal",
    home: "/portal",
    onboarding: "/portal/onboarding",
  });
});

test("sends released Studio staff to the active admin route", () => {
  assert.deepEqual(getPortalClaimDestinations(true, false), {
    admin: "/portal/admin",
    home: "/portal",
    onboarding: "/portal/onboarding",
  });
  assert.deepEqual(getPortalClaimDestinations(true, true), {
    admin: "/admin",
    home: "/",
    onboarding: "/onboarding",
  });
});
