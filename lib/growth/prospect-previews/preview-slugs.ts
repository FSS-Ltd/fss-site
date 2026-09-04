const PREVIEW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BESPOKE_PREVIEW_SLUGS_BY_BUSINESS_NAME = new Map(
  [
    ["Bridgland Roofing", "bridgland-roofing"],
    ["Bridgland Limited", "bridgland-roofing"],
    ["Bright Accounting Ltd", "bright-accounting"],
    ["Bright Fox Lettings", "bright-fox-lettings"],
    ["Best Roofing Ltd", "best-roofing"],
    ["Burfords", "burfords"],
    ["Doorknobs", "doorknobs"],
    ["Dunkley's of Deal", "dunkley-s-of-deal"],
    ["Evo Kent Roofing", "evo-kent-roofing"],
    ["ETE Electrical Contractors", "ete-electrical"],
    ["Fuggles Beer Cafe", "fuggles-beer-cafe"],
    ["Hide and Fox", "hide-and-fox"],
    ["Hazel Motors", "hazel-motors"],
    ["Hazel Motors (Gillingham) Limited", "hazel-motors"],
    ["Hilden Park Chartered Accountants", "hilden-park-accountants"],
    ["Accountants of Kent Limited", "hilden-park-accountants"],
    ["Hill-Wood & Co", "hill-wood"],
    ["Hill-Wood & Co. (Kent) Limited", "hill-wood"],
    ["Hollis Motors", "hollis-motors"],
    ["W. & G. Hollis Limited", "hollis-motors"],
    ["Jaguar Plumbing", "jaguar-plumbing"],
    ["Kemsing Motor Company", "kemsing-motor-company"],
    ["Kent Garage Equipment", "kent-garage-equipment"],
    ["Marden Garage", "marden-garage"],
    ["MD Accountancy Team", "md-accountancy"],
    ["MD Accountancy Team Ltd", "md-accountancy"],
    ["Paperstone", "paperstone"],
    ["Primeline Roofing", "primeline-roofing"],
    ["Priority Point", "priority-point"],
    ["Sealeys Walker Jarvis", "sealeys-walker-jarvis"],
    ["Stagg Homes", "stagg-homes"],
    ["TH Electrical", "th-electrical"],
    ["Tumber Hadley Electrical Ltd", "th-electrical"],
    ["Tunbridge Wells Roofing", "tunbridge-wells-roofing"],
    ["Tunbridge Wells Roofing Limited", "tunbridge-wells-roofing"],
    ["Wormald Accountants", "wormald-accountants"],
  ].map(([businessName, slug]) => [normaliseBusinessName(businessName), slug]),
);

export type ConceptPreviewSlugInput = {
  businessName?: string | null;
  slug: string | null;
};

export function isPreviewSlug(slug: string): boolean {
  return PREVIEW_SLUG_PATTERN.test(slug);
}

export function resolveKnownBespokePreviewSlug(
  businessName: string | null | undefined,
): string | null {
  if (!businessName) return null;

  return (
    BESPOKE_PREVIEW_SLUGS_BY_BUSINESS_NAME.get(
      normaliseBusinessName(businessName),
    ) ?? null
  );
}

export function resolveConceptPreviewSlug({
  businessName,
  slug,
}: ConceptPreviewSlugInput): string | null {
  if (slug && isPreviewSlug(slug)) return slug;

  return resolveKnownBespokePreviewSlug(businessName);
}

function normaliseBusinessName(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
