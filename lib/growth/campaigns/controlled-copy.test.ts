import assert from "node:assert/strict";
import test from "node:test";
import { validateControlledCopy } from "./controlled-copy";
import { buildCampaignCopy } from "./copy";
import { assignCampaignVariant } from "./variants";

const campaignId = "00000000-0000-4000-8000-000000000001";
const businessId = "00000000-0000-4000-8000-000000000002";
const variants = [
  { id: "a", version: 1, cta: "May I send it?" },
  { id: "b", version: 1, cta: "Would that help?" },
] as const;
const variantId = assignCampaignVariant({
  businessId,
  market: "GB",
  seed: `${campaignId}:1`,
  variantIds: ["a", "b"],
});
const variant = variants.find((item) => item.id === variantId);
assert.ok(variant);
const copy = buildCampaignCopy({
  businessName: "Example",
  verifiedOwnerName: null,
  verifiedObservation: "your reviews are unanswered",
  offer: "review",
  previewArtifactId: null,
  previewReviewed: false,
  cta: variant.cta,
});

test("controlled copy binds deterministic variant to canonical source-backed copy", () => {
  const input = {
    campaignId,
    policyVersion: 1,
    businessId,
    market: "GB",
    jurisdiction: "GB",
    offer: "review",
    variants,
    variantId,
    variantVersion: 1,
    businessName: "Example",
    observation: "your reviews are unanswered",
    copy,
  };
  assert.equal(validateControlledCopy(input), true);
  assert.equal(
    validateControlledCopy({
      ...input,
      copy: { ...copy, text: `${copy.text} changed` },
    }),
    false,
  );
  assert.equal(
    validateControlledCopy({
      ...input,
      variantId: variantId === "a" ? "b" : "a",
    }),
    false,
  );
  assert.equal(validateControlledCopy({ ...input, market: "US" }), false);
  assert.equal(validateControlledCopy({ ...input, offer: "monthly" }), false);
});
