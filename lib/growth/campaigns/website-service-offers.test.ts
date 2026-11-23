import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignPolicySchema,
  campaignPolicyDefinitionSchema,
} from "./schemas";
import {
  validateCampaignDefinition,
  serializeCampaignDefinition,
} from "./lifecycle";
import { buildCampaignCopy } from "./copy";
import { validateControlledCopy } from "./controlled-copy";
import { assignCampaignVariant } from "./variants";
import {
  websiteServiceOffers,
  matchesWebsiteServiceOffer,
} from "./website-service-offers";

test("monthly offers preserve the approved distinct terms", () => {
  const offers = Object.values(websiteServiceOffers);
  assert.deepEqual(
    offers.map((offer) => offer.monthlyPence),
    [29700, 49700, 79700],
  );
  for (const offer of offers) {
    assert.equal(offer.currency, "GBP");
    assert.equal(offer.setupFeePence, 0);
    assert.equal(offer.minimumTerm, "none");
    assert.equal(offer.cancellation, "anytime");
    assert.equal(
      offer.websiteScope,
      "entire website build excluding GoHighLevel service add-ons",
    );
    assert.equal(matchesWebsiteServiceOffer(offer.id, offer), true);
  }
  assert.deepEqual(offers[0]?.services, [
    "automatic enquiry follow-up",
    "website appointment assistant",
    "Google review requests",
  ]);
  assert.deepEqual(offers[1]?.services, [
    "unanswered quotes",
    "missed appointments",
    "repeat business",
  ]);
  assert.deepEqual(offers[2]?.services, [
    "inbound call answering",
    "qualification",
    "booking",
    "human handover",
  ]);
  assert.equal(
    matchesWebsiteServiceOffer(offers[0]!.id, {
      ...offers[0],
      monthlyPence: 1,
    }),
    false,
  );
  assert.equal(matchesWebsiteServiceOffer("unknown", offers[0]), false);
});

test("policy JSON retains a supplied terms snapshot and preserves historical absence", () => {
  const terms = websiteServiceOffers.lead_review_essentials_v1;
  const parsed = campaignPolicySchema.parse({
    version: 1,
    offer: terms.id,
    commercialTerms: terms,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)).commercialTerms, terms);
  assert.equal(
    campaignPolicySchema.parse({ version: 1, offer: "review" }).commercialTerms,
    undefined,
  );
});

test("monthly copy requires the selected terms and binds its CTA and source facts", () => {
  const terms = websiteServiceOffers.booking_recovery_v1;
  const campaignId = "00000000-0000-4000-8000-000000000001";
  const businessId = "00000000-0000-4000-8000-000000000002";
  const variants = [
    { id: "a", version: 1, cta: "May I send details?" },
    { id: "b", version: 1, cta: "Would details help?" },
  ];
  const variantId = assignCampaignVariant({
    businessId,
    market: "GB",
    seed: `${campaignId}:1`,
    variantIds: ["a", "b"],
  });
  const variant = variants.find((entry) => entry.id === variantId)!;
  const copy = buildCampaignCopy({
    businessName: "Example",
    verifiedOwnerName: null,
    verifiedObservation: "the booking form is hard to find",
    offer: terms.id,
    commercialTerms: terms,
    previewArtifactId: null,
    previewReviewed: false,
    cta: variant.cta,
  });
  assert.match(copy.text, /£497\/month/);
  assert.match(copy.text, /free entire website build/);
  assert.match(
    copy.text,
    /Recover unanswered quotes, missed appointments and repeat business/,
  );
  assert.match(copy.subject, /Example/);
  assert.doesNotMatch(copy.text, /one-page preview/);
  const input = {
    campaignId,
    policyVersion: 1,
    businessId,
    market: "GB",
    jurisdiction: "GB",
    offer: terms.id,
    commercialTerms: terms,
    variants,
    variantId,
    variantVersion: 1,
    businessName: "Example",
    observation: "the booking form is hard to find",
    copy,
  };
  assert.equal(validateControlledCopy(input), true);
  assert.equal(
    validateControlledCopy({ ...input, commercialTerms: undefined }),
    false,
  );
  assert.equal(
    validateControlledCopy({
      ...input,
      commercialTerms: { ...terms, monthlyPence: 1 },
    }),
    false,
  );
  assert.equal(
    validateControlledCopy({
      ...input,
      copy: { ...copy, text: `${copy.text} changed` },
    }),
    false,
  );
  assert.throws(() =>
    buildCampaignCopy({
      businessName: "Example",
      verifiedOwnerName: null,
      verifiedObservation: "a fact",
      offer: terms.id,
      commercialTerms: undefined,
      previewArtifactId: null,
      previewReviewed: false,
      cta: "May I?",
    }),
  );
});

test("policy approval requires the exact terms and preserves the versioned snapshot", () => {
  const terms = websiteServiceOffers.lead_review_essentials_v1;
  const now = new Date("2026-11-18T00:00:00Z");
  const attestation = {
    summary: "Reviewed",
    reference: { kind: "private", value: "review" },
    observedAt: "2026-11-17T00:00:00Z",
    expiresAt: "2026-11-19T00:00:00Z",
  };
  const raw = {
    version: 1,
    offer: terms.id,
    capabilityEvidence: "review",
    jurisdiction: "GB",
    capabilityAttestation: attestation,
    providerAttestation: {
      ...attestation,
      provider: "gmail",
      jurisdiction: "GB",
      confirmed: true,
    },
  };
  const missing = campaignPolicyDefinitionSchema.parse(raw);
  assert.throws(
    () => validateCampaignDefinition(missing, 1, now, false),
    /invalid_commercial_terms/,
  );
  const changed = campaignPolicyDefinitionSchema.parse({
    ...raw,
    commercialTerms: { ...terms, monthlyPence: 1 },
  });
  assert.throws(
    () => validateCampaignDefinition(changed, 1, now, false),
    /invalid_commercial_terms/,
  );
  const valid = campaignPolicyDefinitionSchema.parse({
    ...raw,
    commercialTerms: terms,
  });
  assert.doesNotThrow(() => validateCampaignDefinition(valid, 1, now, false));
  assert.deepEqual(serializeCampaignDefinition(valid).commercialTerms, terms);
  const wrongOffer = campaignPolicyDefinitionSchema.parse({
    ...raw,
    offer: "review",
    commercialTerms: terms,
  });
  assert.throws(
    () => validateCampaignDefinition(wrongOffer, 1, now, false),
    /invalid_commercial_terms/,
  );
});
