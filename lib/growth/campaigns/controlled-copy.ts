import { buildCampaignCopy } from "./copy";
import { assignCampaignVariant } from "./variants";
import type { CampaignVariant } from "./schemas";

// Facts must come from the locked policy and validated source records.
export function validateControlledCopy(input: {
  campaignId: string;
  policyVersion: number;
  businessId: string;
  market: string;
  jurisdiction: string;
  offer: string;
  variants: readonly CampaignVariant[];
  variantId: string;
  variantVersion: number;
  businessName: string;
  observation: string;
  copy: { subject: string; html: string; text: string };
}): boolean {
  const [first, second] = input.variants;
  if (
    input.market !== input.jurisdiction ||
    !input.market ||
    input.variants.length !== 2 ||
    !first ||
    !second ||
    first.id === second.id ||
    (input.offer !== "review" && input.offer !== "website_preview")
  )
    return false;
  const assigned = assignCampaignVariant({
    businessId: input.businessId,
    market: input.market,
    seed: `${input.campaignId}:${input.policyVersion}`,
    variantIds: [first.id, second.id],
  });
  const variant = input.variants.find((item) => item.id === assigned);
  if (
    !variant ||
    variant.id !== input.variantId ||
    variant.version !== input.variantVersion
  )
    return false;
  try {
    const copy = buildCampaignCopy({
      businessName: input.businessName,
      verifiedOwnerName: null,
      verifiedObservation: input.observation,
      offer: input.offer,
      previewArtifactId: null,
      previewReviewed: false,
      cta: variant.cta,
    });
    return (
      copy.subject === input.copy.subject &&
      copy.html === input.copy.html &&
      copy.text === input.copy.text
    );
  } catch {
    return false;
  }
}
