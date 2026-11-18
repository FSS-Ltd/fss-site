import assert from "node:assert/strict";
import test from "node:test";
import { validPermissionEvidence } from "./permission-evidence";

test("requested service requires recipient-specific offer and full sequence attestation for Gmail GB", () => {
  const now = new Date("2026-11-18T00:00:00Z");
  const evidence = {
    observedAt: "2026-11-17T00:00:00.000Z",
    explicitOptIn: false,
    summary: "Recipient requested this offer and sequence.",
    reference: { kind: "private" as const, value: "record" },
    requestedService: {
      requestedAt: "2026-11-17T00:00:00.000Z",
      offerId: "offer",
      messageScope: "initial_and_two_followups" as const,
      attestsRecipientRequest: true as const,
    },
  };
  const input = {
    basis: "requested_service",
    provider: "gmail",
    jurisdiction: "GB",
    offer: "offer",
    now,
    evidence,
  };
  assert.equal(validPermissionEvidence(input), true);
  assert.equal(
    validPermissionEvidence({ ...input, provider: "resend" }),
    false,
  );
  assert.equal(
    validPermissionEvidence({ ...input, jurisdiction: "FR" }),
    false,
  );
  assert.equal(validPermissionEvidence({ ...input, offer: "other" }), false);
  assert.equal(
    validPermissionEvidence({
      ...input,
      evidence: { ...evidence, requestedService: undefined },
    }),
    false,
  );
  assert.equal(
    validPermissionEvidence({
      ...input,
      evidence: {
        ...evidence,
        requestedService: {
          ...evidence.requestedService,
          requestedAt: "2026-11-19T00:00:00.000Z",
        },
      },
    }),
    false,
  );
  assert.equal(
    validPermissionEvidence({
      ...input,
      evidence: {
        ...evidence,
        requestedService: {
          ...evidence.requestedService,
          messageScope: "initial",
        },
      },
    }),
    false,
  );
});

test("approval rejects unsupported requested-service policy while allowing draft", async () => {
  const { campaignPolicyDefinitionSchema } = await import("./schemas");
  const { validateCampaignDefinition } = await import("./lifecycle");
  const now = new Date("2026-11-18T00:00:00Z");
  const attestation = {
    summary: "Reviewed",
    reference: { kind: "private", value: "review" },
    observedAt: "2026-11-17T00:00:00Z",
    expiresAt: "2026-11-19T00:00:00Z",
  };
  const policy = campaignPolicyDefinitionSchema.parse({
    version: 1,
    effectiveAt: "2026-11-17T00:00:00Z",
    expiresAt: "2026-11-19T00:00:00Z",
    offer: "review",
    capabilityEvidence: "review",
    jurisdiction: "GB",
    provider: "resend",
    permissionRequirement: "requested_service",
    haltThresholds: { hardBounces: 1, complaints: 1 },
    cadenceFamily: "review",
    variants: [
      { id: "a", version: 1, cta: "May I?" },
      { id: "b", version: 1, cta: "Could I?" },
    ],
    capabilityAttestation: attestation,
    providerAttestation: {
      ...attestation,
      provider: "resend",
      jurisdiction: "GB",
      confirmed: true,
    },
  });
  assert.doesNotThrow(() => validateCampaignDefinition(policy, 1, now, false));
  assert.throws(
    () => validateCampaignDefinition(policy, 1, now, true),
    /policy_not_approvable/,
  );
});

test("consent evidence rejects malformed or future references without throwing", () => {
  const input = {
    basis: "consent",
    provider: "gmail",
    jurisdiction: "GB",
    offer: "offer",
    now: new Date("2026-11-18T00:00:00Z"),
    evidence: {
      observedAt: "2026-11-17T00:00:00Z",
      explicitOptIn: true,
      summary: "Opted in",
      reference: { kind: "public", value: "not-a-url" },
    },
  };
  assert.equal(validPermissionEvidence(input), false);
  assert.equal(
    validPermissionEvidence({
      ...input,
      evidence: {
        ...input.evidence,
        observedAt: "2026-11-19T00:00:00Z",
        reference: { kind: "private", value: "record" },
      },
    }),
    false,
  );
});
