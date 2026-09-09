import { z } from "zod";

export const retentionOutcomeSchema = z.strictObject({
  goal: z.string().trim().min(1).max(2000),
  outcome: z.string().trim().max(4000).default(""),
  riskReason: z.string().trim().max(2000).default(""),
});

export type RetentionOutcome = z.infer<typeof retentionOutcomeSchema>;

export function hasExplicitRisk(input: RetentionOutcome): boolean {
  return input.riskReason.length > 0;
}
