import { z } from "zod";
const count = z.number().int().nonnegative();
export const summarySchema = z.object({
  version: z.literal(1),
  londonDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime(),
  dayStatus: z.literal("partial_at_run"),
  preparationEvents: count,
  issuedAttempts: count,
  acceptedAtRead: count,
  observedConfirmations: count,
  confirmedWithinDay: count,
  observedCrossDay: count,
  observedUnknownDay: count,
  unconfirmedAttempts: count,
  heldJobsAtRead: count,
  heldReasons: z.object({
    permission: count,
    account: count,
    coverage: count,
    other: count,
  }),
  goal: z.object({
    minimum: z.literal(100),
    target: z.literal(150),
    conditional: z.literal(true),
  }),
  limitations: z.array(z.string()),
});
export type DailyOutreachSummary = z.infer<typeof summarySchema>;

export const dailySummaryResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), summary: summarySchema }),
  z.object({ status: z.literal("empty") }),
  z.object({ status: z.literal("unavailable") }),
]);
