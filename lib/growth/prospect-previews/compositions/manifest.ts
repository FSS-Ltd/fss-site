import { createProspectPreviewCompositionManifest } from "./manifest-core";
import type { ProspectPreviewComposition } from "./types";
import { brightFoxLettingsComposition } from "./generated/bright-fox-lettings";
import { burfordsComposition } from "./generated/burfords";
import { clarativeAccountingComposition } from "./generated/clarative-accounting";
import { curiousBreweryComposition } from "./generated/curious-brewery";
import { doorknobsComposition } from "./generated/doorknobs";
import { dunkleySOfDealComposition } from "./generated/dunkley-s-of-deal";
import { evoKentRoofingComposition } from "./generated/evo-kent-roofing";
import { fugglesBeerCafeComposition } from "./generated/fuggles-beer-cafe";
import { hideAndFoxComposition } from "./generated/hide-and-fox";
import { jaguarPlumbingComposition } from "./generated/jaguar-plumbing";
import { kBarComposition } from "./generated/k-bar";
import { kemsingMotorCompanyComposition } from "./generated/kemsing-motor-company";
import { kentGarageEquipmentComposition } from "./generated/kent-garage-equipment";
import { mardenGarageComposition } from "./generated/marden-garage";
import { paperstoneComposition } from "./generated/paperstone";
import { paragasComposition } from "./generated/paragas";
import { plumbingAngelsComposition } from "./generated/plumbing-angels";
import { primelineRoofingComposition } from "./generated/primeline-roofing";
import { sealeysWalkerJarvisComposition } from "./generated/sealeys-walker-jarvis";
import { wormaldAccountantsComposition } from "./generated/wormald-accountants";

export { createProspectPreviewCompositionManifest } from "./manifest-core";

const mergedProspectPreviewManifest = createProspectPreviewCompositionManifest([
  brightFoxLettingsComposition,
  burfordsComposition,
  clarativeAccountingComposition,
  curiousBreweryComposition,
  doorknobsComposition,
  dunkleySOfDealComposition,
  evoKentRoofingComposition,
  fugglesBeerCafeComposition,
  hideAndFoxComposition,
  jaguarPlumbingComposition,
  kBarComposition,
  kemsingMotorCompanyComposition,
  kentGarageEquipmentComposition,
  mardenGarageComposition,
  paperstoneComposition,
  paragasComposition,
  plumbingAngelsComposition,
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
