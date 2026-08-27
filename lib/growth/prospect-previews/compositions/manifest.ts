import {
  type ProspectPreviewComposition,
  validateProspectPreviewComposition,
} from "./types";

type ProspectPreviewCompositionManifest = {
  getByProspectId(prospectId: string): ProspectPreviewComposition | null;
  getBySlug(slug: string): ProspectPreviewComposition | null;
};

export function createProspectPreviewCompositionManifest(
  values: readonly ProspectPreviewComposition[],
): ProspectPreviewCompositionManifest {
  const byProspectId = new Map<string, ProspectPreviewComposition>();
  const bySlug = new Map<string, ProspectPreviewComposition>();

  for (const value of values) {
    const composition = validateProspectPreviewComposition(value);
    if (
      byProspectId.has(composition.prospectId) ||
      bySlug.has(composition.slug)
    ) {
      throw new TypeError("Prospect preview composition identities must be unique.");
    }
    byProspectId.set(composition.prospectId, composition);
    bySlug.set(composition.slug, composition);
  }

  return {
    getByProspectId(prospectId) {
      return byProspectId.get(prospectId) ?? null;
    },
    getBySlug(slug) {
      return bySlug.get(slug) ?? null;
    },
  };
}

const mergedProspectPreviewManifest = createProspectPreviewCompositionManifest(
  [],
);

export function getMergedProspectPreviewCompositionBySlug(
  slug: string,
): ProspectPreviewComposition | null {
  return mergedProspectPreviewManifest.getBySlug(slug);
}

export function getMergedProspectPreviewCompositionByProspectId(
  prospectId: string,
): ProspectPreviewComposition | null {
  return mergedProspectPreviewManifest.getByProspectId(prospectId);
}
