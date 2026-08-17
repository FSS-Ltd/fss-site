export const EMAIL_ASSET_FALLBACK_KEYS = [
  "home-property",
  "automotive",
  "professional-services",
  "estate-agency",
  "hospitality",
] as const;

export type EmailAssetFallbackKey = (typeof EMAIL_ASSET_FALLBACK_KEYS)[number];

export interface EmailAssetFallback {
  readonly key: EmailAssetFallbackKey;
  readonly pathname: `/growth/email/fallbacks/${EmailAssetFallbackKey}.webp`;
  readonly altText: string;
  readonly sha256: string;
}

export const EMAIL_ASSET_FALLBACKS = {
  "home-property": {
    key: "home-property",
    pathname: "/growth/email/fallbacks/home-property.webp",
    altText:
      "Concept illustration of a home, service calendar and connected digital enquiry workflow.",
    sha256: "3f9705ce21c90ca0d93cab96667400bb65459f7b86c7649d3b52d4d346af5ec6",
  },
  automotive: {
    key: "automotive",
    pathname: "/growth/email/fallbacks/automotive.webp",
    altText:
      "Concept illustration of a car workshop, booking calendar and connected service workflow.",
    sha256: "0b24ce8680efaee7f6532eb61ba64919aa8d80b3c9079bb71a650ae6d6564383",
  },
  "professional-services": {
    key: "professional-services",
    pathname: "/growth/email/fallbacks/professional-services.webp",
    altText:
      "Concept illustration of a professional workspace, calendar and connected client workflow.",
    sha256: "e951e5bfed6237ced93f33a0d2e3f0d28ad9b150317ab21c88ec7c19ed5810ef",
  },
  "estate-agency": {
    key: "estate-agency",
    pathname: "/growth/email/fallbacks/estate-agency.webp",
    altText:
      "Concept illustration of homes, a viewing calendar and connected property enquiry workflow.",
    sha256: "fe6c9c7675a224f577fef53621c385001922ce9ea870a4a7c9d0500188de147d",
  },
  hospitality: {
    key: "hospitality",
    pathname: "/growth/email/fallbacks/hospitality.webp",
    altText:
      "Concept illustration of a hospitality venue, reservation calendar and connected guest workflow.",
    sha256: "9c769c06f24c18446579b773874d3f87026b3dfae9cdaf798622fb1f3c8783f4",
  },
} as const satisfies Record<EmailAssetFallbackKey, EmailAssetFallback>;

export type EmailAssetResolution =
  | Readonly<{ kind: "stored"; assetId: string }>
  | Readonly<{ kind: "fallback"; asset: EmailAssetFallback }>;

export function resolveEmailAsset(input: {
  assetId: string | null;
  fallbackAssetKey: EmailAssetFallbackKey;
}): EmailAssetResolution {
  if (input.assetId !== null) {
    return { kind: "stored", assetId: input.assetId };
  }

  return {
    kind: "fallback",
    asset: EMAIL_ASSET_FALLBACKS[input.fallbackAssetKey],
  };
}
