import {
  isWebsiteServiceOffer,
  matchesWebsiteServiceOffer,
  type WebsiteServiceTerms,
} from "./website-service-offers";
import { buildCampaignCopy } from "./copy";
import { assignCampaignVariant } from "./variants";
import type { CampaignVariant } from "./schemas";

// Facts must come from the locked policy and validated source records.
type ControlledCopyFacts = {
  campaignId: string;
  policyVersion: number;
  businessId: string;
  market: string;
  jurisdiction: string;
  offer: string;
  commercialTerms?: WebsiteServiceTerms;
  variants: readonly CampaignVariant[];
  businessName: string;
  observation: string;
};

export function buildControlledFirstMessage(input: ControlledCopyFacts): {
  subject: string;
  html: string;
  text: string;
  variantId: string;
  variantVersion: number;
} | null {
  const [first, second] = input.variants;
  if (
    input.market !== input.jurisdiction ||
    !input.market ||
    input.variants.length !== 2 ||
    !first ||
    !second ||
    first.id === second.id ||
    (input.offer !== "review" &&
      input.offer !== "website_preview" &&
      (!isWebsiteServiceOffer(input.offer) ||
        !matchesWebsiteServiceOffer(input.offer, input.commercialTerms)))
  )
    return null;
  const assigned = assignCampaignVariant({
    businessId: input.businessId,
    market: input.market,
    seed: `${input.campaignId}:${input.policyVersion}`,
    variantIds: [first.id, second.id],
  });
  const variant = input.variants.find((item) => item.id === assigned);
  if (!variant) return null;
  try {
    const copy = buildCampaignCopy({
      businessName: input.businessName,
      verifiedOwnerName: null,
      verifiedObservation: input.observation,
      offer: input.offer,
      commercialTerms: input.commercialTerms,
      previewArtifactId: null,
      previewReviewed: false,
      cta: variant.cta,
    });
    return {
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      variantId: variant.id,
      variantVersion: variant.version,
    };
  } catch {
    return null;
  }
}

export function validateControlledCopy(
  input: ControlledCopyFacts & {
    variantId: string;
    variantVersion: number;
    copy: { subject: string; html: string; text: string };
  },
): boolean {
  const result = buildControlledFirstMessage(input);
  return (
    result !== null &&
    result.variantId === input.variantId &&
    result.variantVersion === input.variantVersion &&
    result.subject === input.copy.subject &&
    result.html === input.copy.html &&
    result.text === input.copy.text
  );
}
