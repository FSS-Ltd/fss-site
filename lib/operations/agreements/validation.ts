import { z } from "zod";
import type { AgreementDraft, AgreementLine, SignatureEvidence } from "./types";
import { currencySchema } from "../money";

export const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,17})$/, "Use whole minor units, without decimals.");
export const dateOnly = z.iso.date();
export const privateReference = z
  .string()
  .max(300)
  .regex(
    /^private:[a-zA-Z0-9][a-zA-Z0-9/_-]*(?:\.[a-zA-Z0-9]+)?$/,
    "Use a private: object reference, without a URL or access token.",
  )
  .refine((v) => !v.includes(".."));
const text = z.string().trim().min(1).max(4000);
export const revenueShareSchema = z.strictObject({
  percentageBps: z.number().int().min(1).max(10000),
  revenueSource: text,
  calculationBasis: text,
  duration: text,
  reportingRequirements: text,
  paymentTerms: text,
});
const signatories = z
  .array(z.email().toLowerCase())
  .min(1)
  .max(10)
  .refine(
    (v) => new Set(v).size === v.length,
    "Each signatory must be unique.",
  );
export const lineSchema = z
  .strictObject({
    serviceCode: z.string().trim().min(1).max(100),
    description: text,
    quantity: z.number().int().min(1).max(10000),
    unitPence: money,
    discountPence: money,
    taxPence: money,
    recurrenceMonths: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(3),
      z.literal(12),
    ]),
    startDate: dateOnly,
    endDate: dateOnly.nullable(),
  })
  .superRefine((line, ctx) => {
    if (
      ![line.unitPence, line.discountPence, line.taxPence].every(
        (v) => money.safeParse(v).success,
      )
    )
      return;
    if (
      BigInt(line.discountPence) >
      BigInt(line.unitPence) * BigInt(line.quantity)
    )
      ctx.addIssue({
        code: "custom",
        path: ["discountPence"],
        message: "Discount exceeds the line net value.",
      });
    if (line.endDate && line.endDate < line.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
  });
export const draftSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    scope: text,
    goals: text,
    terms: text,
    support: text,
    responsibilities: text,
    billingContact: z.email().toLowerCase(),
    signatories: signatories.transform((v) => [...v].sort()),
    documentHash: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/,
        "Use the SHA-256 hash of the reviewed source document.",
      ),
    documentReference: privateReference,
    currency: currencySchema,
    revenueShare: revenueShareSchema.optional(),
    taxTreatment: text,
    noticeDays: z.number().int().min(0).max(3650),
    minimumTermMonths: z.number().int().min(0).max(120),
    requiredDepositPence: money,
    assetsRequired: z.boolean(),
    lines: z.array(lineSchema).min(1).max(30),
    installments: z
      .array(
        z.strictObject({
          dueDate: dateOnly,
          amountPence: money.refine(
            (v) => /^\d+$/.test(v) && BigInt(v) > BigInt(0),
            "Installment must be positive.",
          ),
        }),
      )
      .max(30),
  })
  .superRefine((draft, ctx) => {
    if (
      draft.revenueShare &&
      draft.lines.some(
        (line) =>
          line.recurrenceMonths !== 0 &&
          [line.unitPence, line.discountPence, line.taxPence].some(
            (value) => value !== "0",
          ),
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Revenue share replaces all ongoing cash charges.",
      });
    }
    if (
      !draft.lines.every((l) => lineSchema.safeParse(l).success) ||
      !draft.installments.every((i) => money.safeParse(i.amountPence).success)
    )
      return;
    const oneOff = draft.lines
      .filter((l) => l.recurrenceMonths === 0)
      .reduce((sum, l) => sum + BigInt(totalLinePence(l)), BigInt(0));
    if (
      draft.installments.reduce(
        (sum, i) => sum + BigInt(i.amountPence),
        BigInt(0),
      ) !== oneOff
    )
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message:
          "Installments must allocate the exact one-off total including tax.",
      });
    if (
      draft.installments.some(
        (i, index) =>
          index > 0 && i.dueDate < draft.installments[index - 1].dueDate,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message: "Put installments in due-date order.",
      });
  });
export const signatureSchema = z.strictObject({
  confirmed: z.literal(true, {
    error: "Confirm that all required parties signed this exact revision.",
  }),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  signedDocumentHash: z.string().regex(/^[a-f0-9]{64}$/),
  documentReference: privateReference,
  certificateReference: privateReference.nullable(),
  signatories: signatories.transform((v) => [...v].sort()),
  signedDate: dateOnly,
});
export function totalLinePence(line: AgreementLine): string {
  return (
    BigInt(line.unitPence) * BigInt(line.quantity) -
    BigInt(line.discountPence) +
    BigInt(line.taxPence)
  ).toString();
}
export function parseAgreementDraft(input: unknown): AgreementDraft {
  return draftSchema.parse(input);
}
export function parseSignatureEvidence(input: unknown): SignatureEvidence {
  return signatureSchema.parse(input);
}
