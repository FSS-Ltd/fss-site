import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOnboardingReadiness,
  canStartOnboardingJourney,
} from "./readiness";

test("readiness reports the exact server-owned repair path", () => {
  const checks = buildOnboardingReadiness({
    senderConfigured: false,
    currentAgreement: true,
    noActiveJourney: true,
    contactAvailable: true,
    templateVersionAvailable: true,
    recipientRoleAllowed: true,
    billingConfigured: true,
    signingReady: true,
  });

  assert.deepEqual(
    checks.find((check) => check.id === "sender"),
    {
      id: "sender",
      status: "needs_action",
      reason: "Choose an authorised FSS sender.",
      href: "/portal/admin/settings",
    },
  );
  assert.equal(canStartOnboardingJourney(checks), false);
});

test("readiness permits start only when each required server check passes", () => {
  const checks = buildOnboardingReadiness({
    senderConfigured: true,
    currentAgreement: true,
    noActiveJourney: true,
    contactAvailable: true,
    templateVersionAvailable: true,
    recipientRoleAllowed: true,
    billingConfigured: true,
    signingReady: true,
  });

  assert.equal(canStartOnboardingJourney(checks), true);
});
