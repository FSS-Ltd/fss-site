import { z } from "zod";

const optionalDraftReferenceSchema = z
  .strictObject({
    draftId: z.uuid().optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .superRefine(({ draftId, expectedVersion }, context) => {
    if ((draftId === undefined) !== (expectedVersion === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Draft identity and version must be provided together.",
      });
    }
  });

const reviewText = z.string().trim().min(1).max(4_000);

export const engagementCommandSchema = z.discriminatedUnion("action", [
  optionalDraftReferenceSchema.extend({
    action: z.literal("create"),
    commandId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    primaryGoal: reviewText,
    proposedScope: reviewText,
    reviewReference: z.string().trim().min(1).max(200),
    reviewed: z.literal(true),
  }),
  optionalDraftReferenceSchema.extend({
    action: z.literal("select"),
    commandId: z.uuid(),
    engagementId: z.uuid(),
  }),
]);

export type EngagementCommand = z.infer<typeof engagementCommandSchema>;
