import { z } from "zod";
import { welcomeInputSchema } from "./approval-schema";
const access = z
  .array(
    z.strictObject({
      email: z.email(),
      role: z.enum(["owner", "contributor", "billing_contact", "viewer"]),
    }),
  )
  .min(1)
  .max(21);
const binding = {
  journeyId: z.uuid(),
  expectedGeneration: z.number().int().positive(),
  expectedProposalApprovalId: z.uuid().nullable(),
};
export const welcomeWorkspaceBindingSchema = z.strictObject({
  draftId: z.uuid(),
  expectedDraftVersion: z.number().int().positive(),
  templateVersionId: z.uuid(),
  contactId: z.uuid(),
  recipientRole: z.enum(["owner", "contributor", "billing_contact", "viewer"]),
});
export const journeyCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("preview_welcome"),
    agreementId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    welcome: welcomeInputSchema,
    workspace: welcomeWorkspaceBindingSchema.optional(),
  }),
  z.strictObject({
    action: z.literal("start"),
    token: z.string().min(1).max(4_000_000),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    action: z.literal("preview_proposal"),
    ...binding,
    signingApprovalId: z.uuid(),
    access,
    scopeSummary: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    action: z.literal("approve_proposal"),
    token: z.string().min(1).max(4_000_000),
    confirmed: z.literal(true),
  }),
  z.strictObject({ action: z.enum(["pause", "resume", "cancel"]), ...binding }),
  z.strictObject({
    action: z.literal("retry"),
    ...binding,
    jobId: z.uuid(),
    reviewReference: z.string().trim().min(1).max(200),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    action: z.literal("reconcile"),
    ...binding,
    jobId: z.uuid(),
    providerId: z.string().trim().min(1).max(300),
    acceptedAt: z.iso.datetime({ offset: true }),
    reviewReference: z.string().trim().min(1).max(500),
    confirmed: z.literal(true),
  }),
]);

export type JourneyCommand = z.infer<typeof journeyCommandSchema>;
