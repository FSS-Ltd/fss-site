import { createProspectPreviewCompositionManifest } from "./manifest-core";
import type { ProspectPreviewComposition } from "./types";
import { brightFoxLettingsComposition } from "./generated/bright-fox-lettings";
import { dunkleySOfDealComposition } from "./generated/dunkley-s-of-deal";
import { evoKentRoofingComposition } from "./generated/evo-kent-roofing";
import { fugglesBeerCafeComposition } from "./generated/fuggles-beer-cafe";
import { hideAndFoxComposition } from "./generated/hide-and-fox";
import { mardenGarageComposition } from "./generated/marden-garage";
import { paperstoneComposition } from "./generated/paperstone";
import { primelineRoofingComposition } from "./generated/primeline-roofing";
import { sealeysWalkerJarvisComposition } from "./generated/sealeys-walker-jarvis";
import { wormaldAccountantsComposition } from "./generated/wormald-accountants";

export { createProspectPreviewCompositionManifest } from "./manifest-core";

const mergedProspectPreviewManifest = createProspectPreviewCompositionManifest([
  brightFoxLettingsComposition,
  dunkleySOfDealComposition,
  evoKentRoofingComposition,
  fugglesBeerCafeComposition,
  hideAndFoxComposition,
  mardenGarageComposition,
  paperstoneComposition,
  primelineRoofingComposition,
  sealeysWalkerJarvisComposition,
  wormaldAccountantsComposition,
]);

export function getMergedProspectPreviewCompositionBySlug(slug: string): ProspectPreviewComposition | null {
  return mergedProspectPreviewManifest.getBySlug(slug);
}

export function getMergedProspectPreviewCompositionByProspectId(prospectId: string): ProspectPreviewComposition | null {
  return mergedProspectPreviewManifest.getByProspectId(prospectId);
}
