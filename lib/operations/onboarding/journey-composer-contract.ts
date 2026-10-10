import { z } from "zod";
import { welcomePackContentSchema } from "./welcome-pack-contract";
import { welcomeSummarySchema } from "./welcome-agreement-callouts";

/** Editing state is retained separately from the immutable reviewed welcome. */
export const journeyComposerSchema = z.strictObject({
  packet: welcomePackContentSchema,
  packVersionId: z.uuid(),
  scopeSummary: welcomeSummarySchema.or(z.literal("")).default(""),
  responsibilitiesSummary: welcomeSummarySchema.or(z.literal("")).default(""),
  obligationKey: z.string().max(200),
  settingsRevision: z.number().int().nonnegative(),
});
export type JourneyComposer = z.infer<typeof journeyComposerSchema>;
