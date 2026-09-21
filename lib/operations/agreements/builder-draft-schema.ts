import { z } from "zod";
import { dateOnly, lineSchema, money } from "./validation";

export const agreementBuilderSteps = [
  "link",
  "scope",
  "fees",
  "people",
  "document",
  "review",
] as const;

export const agreementBuilderStepSchema = z.enum(agreementBuilderSteps);

export type AgreementBuilderStep = z.infer<typeof agreementBuilderStepSchema>;

const text = z.string().trim().min(1).max(4_000);
const contactEmail = z.email().transform((email) => email.toLowerCase());
const installmentSchema = z.strictObject({
  amountPence: money,
  dueDate: dateOnly,
});

const partialAgreementSchema = z.strictObject({
  assetsRequired: z.boolean().optional(),
  billingContact: contactEmail.optional(),
  currency: z.literal("GBP").optional(),
  goals: text.optional(),
  installments: z.array(installmentSchema).max(30).optional(),
  lines: z.array(lineSchema).max(30).optional(),
  minimumTermMonths: z.number().int().min(0).max(120).optional(),
  noticeDays: z.number().int().min(0).max(3_650).optional(),
  requiredDepositPence: money.optional(),
  responsibilities: text.optional(),
  scope: text.optional(),
  signatories: z.array(contactEmail).min(1).max(10).optional(),
  support: text.optional(),
  taxTreatment: text.optional(),
  terms: text.optional(),
  title: z.string().trim().min(1).max(200).optional(),
});

const completeAgreementSchema = z.strictObject({
  assetsRequired: z.boolean(),
  billingContact: contactEmail,
  currency: z.literal("GBP"),
  goals: text,
  installments: z.array(installmentSchema).max(30),
  lines: z.array(lineSchema).min(1).max(30),
  minimumTermMonths: z.number().int().min(0).max(120),
  noticeDays: z.number().int().min(0).max(3_650),
  requiredDepositPence: money,
  responsibilities: text,
  scope: text,
  signatories: z.array(contactEmail).min(1).max(10),
  support: text,
  taxTreatment: text,
  terms: text,
  title: z.string().trim().min(1).max(200),
});

export const agreementBuilderDraftContentSchema = z.strictObject({
  agreement: partialAgreementSchema.optional(),
  engagementId: z.uuid().optional(),
});

export const completeAgreementBuilderDraftContentSchema = z.strictObject({
  agreement: completeAgreementSchema,
  engagementId: z.uuid(),
});

export type AgreementBuilderDraftContent = z.infer<
  typeof agreementBuilderDraftContentSchema
>;

export const agreementBuilderDraftCommandSchema = z.discriminatedUnion(
  "action",
  [
    z.strictObject({
      action: z.literal("save"),
      content: agreementBuilderDraftContentSchema,
      draftId: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      step: agreementBuilderStepSchema,
    }),
    z.strictObject({
      action: z.literal("finalise"),
      draftId: z.uuid(),
      expectedVersion: z.number().int().positive(),
    }),
  ],
);

export type SaveAgreementBuilderDraftCommand = Extract<
  z.infer<typeof agreementBuilderDraftCommandSchema>,
  { action: "save" }
>;

export type FinaliseAgreementBuilderDraftCommand = Extract<
  z.infer<typeof agreementBuilderDraftCommandSchema>,
  { action: "finalise" }
>;
