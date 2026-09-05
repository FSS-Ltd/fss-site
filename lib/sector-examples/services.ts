import type { ExampleTheme } from "./catalog";
export type ExampleService = {
  slug: string;
  title: string;
  description: string;
  question: string;
  answer: string;
  steps: readonly [string, string][];
  preparation: readonly string[];
};

import { roofServices } from "./services/roof";
import { estateServices } from "./services/estate";
import { accountsServices } from "./services/accounts";
import { autoServices } from "./services/auto";
import { plumbingServices } from "./services/plumbing";
import { electricalServices } from "./services/electrical";
import { hospitalityServices } from "./services/hospitality";
import { landscapeServices } from "./services/landscape";
import { suppliesServices } from "./services/supplies";
import { equipmentServices } from "./services/equipment";
export const exampleServices: Record<ExampleTheme, readonly ExampleService[]> =
  {
    roof: roofServices,
    estate: estateServices,
    accounts: accountsServices,
    auto: autoServices,
    plumbing: plumbingServices,
    electrical: electricalServices,
    hospitality: hospitalityServices,
    landscape: landscapeServices,
    supplies: suppliesServices,
    equipment: equipmentServices,
  };
