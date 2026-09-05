import type { ComponentType } from "react";
import { Stillwater, CopperField, Warmform, Flowline } from "./plumbing";
import {
  LumenWorks,
  CircuitLedger,
  PhaseStudio,
  CurrentCare,
} from "./electrical";
export const tradesVariants: Record<string, ComponentType> = {
  stillwater: Stillwater,
  "copper-field": CopperField,
  warmform: Warmform,
  flowline: Flowline,
  "lumen-works": LumenWorks,
  "circuit-ledger": CircuitLedger,
  "phase-studio": PhaseStudio,
  "current-care": CurrentCare,
};
