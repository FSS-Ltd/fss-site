const PREVIEW_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BESPOKE_PREVIEW_SLUGS_BY_BUSINESS_NAME = new Map(
  [
    ["Bright Accounting Ltd", "bright-accounting"],
    ["Bright Fox Lettings", "bright-fox-lettings"],
    ["Burfords", "burfords"],
    ["Doorknobs", "doorknobs"],
    ["Dunkley's of Deal", "dunkley-s-of-deal"],
    ["Evo Kent Roofing", "evo-kent-roofing"],
    ["Fuggles Beer Cafe", "fuggles-beer-cafe"],
    ["Hide and Fox", "hide-and-fox"],
    ["Jaguar Plumbing", "jaguar-plumbing"],
    ["Kemsing Motor Company", "kemsing-motor-company"],
    ["Kent Garage Equipment", "kent-garage-equipment"],
    ["Marden Garage", "marden-garage"],
    ["Paperstone", "paperstone"],
    ["Primeline Roofing", "primeline-roofing"],
    ["Sealeys Walker Jarvis", "sealeys-walker-jarvis"],
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
