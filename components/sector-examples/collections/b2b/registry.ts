import type { ComponentType } from "react";
import {
  OrbitSupplyExample,
  SupplyIndexExample,
  CommonplaceOfficeExample,
  DeskReadyExample,
} from "./supplies";
import {
  AxisWorkshopExample,
  WorkshopReferenceExample,
  IronfieldEquipmentExample,
  BayPlanExample,
} from "./equipment";

export const b2bExamplePages: Record<string, ComponentType> = {
  "orbit-supply": OrbitSupplyExample,
  "supply-index": SupplyIndexExample,
  "commonplace-office": CommonplaceOfficeExample,
  "desk-ready": DeskReadyExample,
  "axis-workshop": AxisWorkshopExample,
  "workshop-reference": WorkshopReferenceExample,
  "ironfield-equipment": IronfieldEquipmentExample,
  "bay-plan": BayPlanExample,
};
