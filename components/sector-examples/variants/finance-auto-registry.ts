import type { ComponentType } from "react";
import { Unfold } from "./unfold";
import { Ledger } from "./ledger";
import { NorthNumbers } from "./north-numbers";
import { Torque } from "./torque";
import { Vantage } from "./vantage";
import { Sunday } from "./sunday";
export const financeAutoVariants: Record<string, ComponentType> = {
  "unfold-finance": Unfold,
  "ledger-and-co": Ledger,
  "north-and-numbers": NorthNumbers,
  "torque-workshop": Torque,
  "vantage-motor-co": Vantage,
  "sunday-garage": Sunday,
};
