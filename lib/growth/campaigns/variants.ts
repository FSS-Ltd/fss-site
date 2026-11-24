import { createHash } from "node:crypto";
export function assignCampaignVariant(input: {
  businessId: string;
  market: string;
  seed: string;
  variantIds: readonly [string, string];
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([input.businessId, input.market, input.seed]))
    .digest();
  return input.variantIds[digest[0] % 2];
}
