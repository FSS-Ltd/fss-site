import type { ComponentType } from "react";
import { RoofingExample } from "./roofing";
import { EstateExample } from "./estate";
import { AutomotiveExample } from "./automotive";
import { AccountancyExample } from "./accountancy";
import { CrownlineExample } from "./variants/crownline";
import { SlateHouseExample } from "./variants/slate-house";
import { NorthfieldExample } from "./variants/northfield";
import { ValeCityExample } from "./variants/vale-city";
import { FieldworkExample } from "./variants/fieldwork";
import { MaisonExample } from "./variants/maison";
import { tradesVariants } from "./collections/trades/registry";
import { b2bExamplePages } from "./collections/b2b/registry";
import { hospitalityLandscapeRegistry } from "./collections/hospitality-landscape/registry";
import { financeAutoVariants } from "./variants/finance-auto-registry";
export const examplePages: Record<string, ComponentType> = {
  "ridge-and-vale": RoofingExample,
  "hearth-and-acre": EstateExample,
  "apex-motorworks": AutomotiveExample,
  "folio-accountants": AccountancyExample,
  "crownline-roofing": CrownlineExample,
  "slate-house": SlateHouseExample,
  "northfield-roofing": NorthfieldExample,
  "vale-and-city": ValeCityExample,
  "fieldwork-homes": FieldworkExample,
  "maison-property": MaisonExample,
  ...tradesVariants,
  ...b2bExamplePages,
  ...hospitalityLandscapeRegistry,
  ...financeAutoVariants,
};
