import { isDeepStrictEqual } from "node:util";
import { serializeCampaignDefinition } from "./lifecycle";
import { campaignPolicyDefinitionSchema } from "./schemas";
import {
  isWebsiteServiceOffer,
  matchesWebsiteServiceOffer,
} from "./website-service-offers";

// Never normalize away fields from an older or newer policy while revising it.
export function readEditableCampaignPolicy(value: unknown) {
  const parsed = campaignPolicyDefinitionSchema.safeParse(value);
  if (!parsed.success) return null;
  const policy = parsed.data;
  if (
    policy.variants.length > 2 ||
    policy.cadenceFamily === "facebook" ||
    (policy.offer !== null &&
      policy.offer !== "review" &&
      policy.offer !== "website_preview" &&
      !isWebsiteServiceOffer(policy.offer)) ||
    (policy.commercialTerms &&
      (!policy.offer ||
        !matchesWebsiteServiceOffer(policy.offer, policy.commercialTerms))) ||
    (policy.offer &&
      isWebsiteServiceOffer(policy.offer) &&
      !matchesWebsiteServiceOffer(policy.offer, policy.commercialTerms))
  )
    return null;
  const serialized = serializeCampaignDefinition(policy);
  return isDeepStrictEqual(value, serialized) ? { policy, serialized } : null;
}
