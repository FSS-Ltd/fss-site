import { z } from "zod";
import { globalResearchRunSchema } from "./global-schema";
import { researchRunIngestionSchema } from "./ingestion-schema";

export const researchIntakeSchema = z.union([
  researchRunIngestionSchema,
  globalResearchRunSchema,
]);
export type ResearchIntake = z.infer<typeof researchIntakeSchema>;
