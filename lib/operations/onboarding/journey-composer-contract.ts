import { z } from "zod";
import { welcomePackContentSchema } from "./welcome-pack-contract";

/** Editing state is retained separately from the immutable reviewed welcome. */
export const journeyComposerSchema = z.strictObject({
  packet: welcomePackContentSchema,
  packVersionId: z.uuid(),
  obligationKey: z.string().max(200),
  settingsRevision: z.number().int().nonnegative(),
});
export type JourneyComposer = z.infer<typeof journeyComposerSchema>;
