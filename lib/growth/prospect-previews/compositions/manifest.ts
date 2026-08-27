import { createProspectPreviewCompositionManifest } from "./manifest-core";
import type { ProspectPreviewComposition } from "./types";

export { createProspectPreviewCompositionManifest } from "./manifest-core";

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
