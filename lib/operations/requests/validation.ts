import { z } from "zod";
import {
  requestScopes,
  founderDeliveryOwnerId,
  requestPriorities,
} from "./types";
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = z.string().trim().max(4000).default("");
export const createRequestSchema = z
  .strictObject({
    projectId: z.uuid(),
    title: text(160),
    description: text(10000),
    type: z.enum(["work", "change", "bug", "help"]),
    desiredOutcome: text(4000),
    desiredDate: z.iso.date().nullable().default(null),
    impact: optionalText,
    reproductionSteps: optionalText,
    expectedBehaviour: optionalText,
    actualBehaviour: optionalText,
    idempotencyKey: z.uuid(),
  })
  .superRefine((v, c) => {
    if (v.type === "bug")
      for (const field of [
        "reproductionSteps",
        "expectedBehaviour",
        "actualBehaviour",
      ] as const)
        if (!v[field])
          c.addIssue({
            code: "custom",
            path: [field],
            message: "Required for bug reports.",
          });
  });
const base = {
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
const currentReview = {
  ...base,
  deliverableVersion: text(200),
  reviewCycle: z.number().int().positive(),
};
export const portalRequestCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...base, action: z.literal("comment"), body: text(10000) }),
  z.strictObject({ ...currentReview, action: z.literal("accept") }),
  z.strictObject({
    ...currentReview,
    action: z.literal("request_changes"),
    feedback: text(10000),
  }),
]);
export const founderRequestCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...base,
    action: z.literal("set_priority"),
    priority: z.enum(requestPriorities),
  }),
  z.strictObject({
    ...base,
    action: z.literal("classify_scope"),
    scope: z.enum(requestScopes),
    scopeReason: optionalText,
    agreementId: z.uuid().nullable().default(null),
  }),
  z.strictObject({
    ...base,
    action: z.literal("acknowledge"),
    ownerDisplay: text(160),
    deliveryOwnerId: z
      .literal(founderDeliveryOwnerId)
      .default(founderDeliveryOwnerId),
    scope: z.enum(requestScopes),
    scopeReason: optionalText,
  }),
  z.strictObject({
    ...base,
    action: z.literal("plan"),
    nextAction: text(4000),
    targetDate: z.iso.date().nullable().default(null),
    agreementId: z.uuid().nullable().default(null),
  }),
  z.strictObject({
    ...base,
    action: z.literal("start"),
    capacityOverrideReason: optionalText,
  }),
  z.strictObject({
    ...base,
    action: z.literal("review"),
    deliverableVersion: text(200),
    reviewInstructions: text(4000),
    publicSummary: text(4000),
    documentIds: z.array(z.uuid()).max(20).default([]),
  }),
  z.strictObject({
    ...base,
    action: z.literal("revise"),
    revisionDecision: z.enum(["included", "assessment_pending"]),
    reason: text(4000),
    capacityOverrideReason: optionalText,
  }),
  ...(["cancel", "close", "reopen"] as const).map((action) =>
    z.strictObject({ ...base, action: z.literal(action), reason: text(4000) }),
  ),
  z.strictObject({
    ...base,
    action: z.literal("block"),
    blocked: z
      .strictObject({
        reason: text(4000),
        responsibleParty: text(160),
        nextCheckDate: z.iso.date(),
      })
      .nullable(),
  }),
  z.strictObject({
    ...base,
    action: z.literal("comment"),
    body: text(10000),
    visibility: z.enum(["internal", "client"]),
  }),
  z.strictObject({
    ...base,
    action: z.literal("designate_reviewer"),
    userId: z.uuid(),
    enabled: z.boolean(),
  }),
  z.strictObject({
    ...base,
    action: z.literal("allowance"),
    unit: z.enum(["hours", "tasks", "milestones"]),
    amount: z
      .number()
      .min(-1000000)
      .max(1000000)
      .multipleOf(0.01)
      .refine((v) => v !== 0, "Adjustment cannot be zero."),
    reason: text(4000),
    approvalReference: text(200),
  }),
]);
export type FounderRequestCommand = z.infer<typeof founderRequestCommandSchema>;
