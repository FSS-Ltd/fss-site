import assert from "node:assert/strict";
import test from "node:test";
import {
  buildControlledFirstMessage,
  validateControlledCopy,
  controlledCopyFamilyFingerprint,
  CONTROLLED_FIRST_COPY_FAMILY_VERSION,
} from "./controlled-copy";
import { websiteServiceOffers } from "./website-service-offers";
import { campaignSchema } from "./gmail-confirmation-campaign";

const facts = {
  campaignId: "4acff217-ea77-429c-a5b0-9a52e82f87ac",
  policyVersion: 1,
  businessId: "6e6e5795-5c30-47dc-a454-dc14df3b8192",
  market: "GB",
  jurisdiction: "GB",
  businessName: "Sample Business",
  observation: "The website offers appointment booking",
  variants: [
    { id: "a", version: 1, cta: "May I send details?" },
    { id: "b", version: 1, cta: "Could I send details?" },
  ],
};

test("first message freezes the selected policy arm and approved commercial terms", () => {
  const offer = websiteServiceOffers.lead_review_essentials_v1;
  const result = buildControlledFirstMessage({
    ...facts,
    offer: offer.id,
    commercialTerms: offer,
  });
  assert.ok(result);
  assert.equal(result.subject, "A question about Sample Business");
  assert.match(result.text, /£297\/month/);
  assert.equal(
    validateControlledCopy({
      ...facts,
      offer: offer.id,
      commercialTerms: offer,
      variantId: result.variantId,
      variantVersion: result.variantVersion,
      copy: result,
    }),
    true,
  );
  assert.equal(
    validateControlledCopy({
      ...facts,
      offer: offer.id,
      commercialTerms: offer,
      variantId: result.variantId,
      variantVersion: result.variantVersion,
      copy: { ...result, text: result.text + " edited" },
    }),
    false,
  );
  assert.ok(
    facts.variants.some(
      (variant) =>
        variant.id === result.variantId && result.text.includes(variant.cta),
    ),
  );
  assert.equal(
    buildControlledFirstMessage({ ...facts, offer: offer.id }),
    null,
  );
  assert.equal(
    buildControlledFirstMessage({ ...facts, offer: "unsupported" }),
    null,
  );
  assert.equal(
    buildControlledFirstMessage({ ...facts, market: "US", offer: "review" }),
    null,
  );
});

test("confirmation retains the exact issued commercial terms", () => {
  const recipient = {
    email: "contact@example.test",
    contactId: "9f65edb8-51e8-4a2a-9ca0-627810c1c029",
    contactVersion: 1,
    prospectVersion: 1,
  };
  const offer = websiteServiceOffers.booking_recovery_v1;
  const snapshot = campaignSchema.parse({
    campaignId: facts.campaignId,
    policyVersion: 1,
    membershipId: "e7832f24-891b-4648-9e1c-ef63da18ef8e",
    businessId: facts.businessId,
    cadenceFamily: "website",
    market: "GB",
    offer: offer.id,
    commercialTerms: offer,
    variantId: "a",
    variantVersion: 1,
    copySha256: "a".repeat(64),
    permissionId: "5203b254-5ed9-4cf1-a852-934a8d4a85ee",
    reviewedRecipient: recipient,
    effectiveRecipient: recipient,
    sourceProof: {
      origin: "founder",
      requestId: "3dc1db0c-27f2-4db6-aa1d-9f29996b4401",
      contactId: recipient.contactId,
      contactProofId: "0e1403f0-82b7-4b39-bce7-2086a22fcb5c",
      observationProofId: "2ea63c47-ae13-4dbf-a7d0-e3d33c5e810f",
      proofContactVersion: 1,
      proofProspectVersion: 1,
      freshUntil: "2026-12-30T00:00:00Z",
    },
  });
  assert.deepEqual(snapshot.commercialTerms, offer);
  assert.equal(snapshot.copyFamilyVersion, undefined);
  assert.equal(snapshot.copyFamilySha256, undefined);
  const frozen = campaignSchema.parse({
    ...snapshot,
    copyFamilyVersion: 1,
    copyFamilySha256: "b".repeat(64),
  });
  assert.equal(frozen.copyFamilySha256, "b".repeat(64));
  assert.equal(
    campaignSchema.safeParse({ ...snapshot, copyFamilyVersion: 1 }).success,
    false,
  );
});

test("copy family is shared across arms and binds the common policy contract", () => {
  const family = {
    familyVersion: CONTROLLED_FIRST_COPY_FAMILY_VERSION,
    campaignId: facts.campaignId,
    policyVersion: 1,
    market: "GB",
    jurisdiction: "GB",
    offer: "review",
    permissionRequirement: "consent",
    cadenceFamily: "review",
    provider: "resend",
  };
  const armA = { ...family, variantId: "a", cta: "May I?" };
  const armB = { ...family, variantId: "b", cta: "Could I?" };
  const fingerprint = controlledCopyFamilyFingerprint(armA);
  assert.equal(
    fingerprint,
    "047bd0aeb7db93969d1b2dd957900a42325a1528ad9d13cbfa954734746e8a84",
  );
  assert.equal(controlledCopyFamilyFingerprint(armB), fingerprint);
  assert.notEqual(
    controlledCopyFamilyFingerprint({ ...family, familyVersion: 2 }),
    fingerprint,
  );
  assert.notEqual(
    controlledCopyFamilyFingerprint({ ...family, provider: "gmail" }),
    fingerprint,
  );
  assert.notEqual(
    controlledCopyFamilyFingerprint({
      ...family,
      campaignId: facts.businessId,
    }),
    fingerprint,
  );
  const terms = websiteServiceOffers.lead_review_essentials_v1;
  assert.notEqual(
    controlledCopyFamilyFingerprint({ ...family, commercialTerms: terms }),
    fingerprint,
  );
  assert.equal(
    controlledCopyFamilyFingerprint({
      ...family,
      commercialTerms: { ...terms, id: terms.id },
    }),
    controlledCopyFamilyFingerprint({ ...family, commercialTerms: terms }),
  );
});
