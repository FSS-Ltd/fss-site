import { z } from "zod";
import { draftSchema, money, totalLinePence } from "./validation";
import type { AgreementDraft } from "./types";

const terms = {
  revenueSource: z.string().trim().min(1).max(4000),
  calculationBasis: z.string().trim().min(1).max(4000),
  duration: z.string().trim().min(1).max(4000),
  reportingRequirements: z.string().trim().min(1).max(4000),
  paymentTerms: z.string().trim().min(1).max(4000),
};
export const commercialOfferSpecSchema = z
  .strictObject({
    cash: z
      .strictObject({ mode: z.enum(["fixed", "client_proposed"]) })
      .nullable(),
    revenueShare: z
      .discriminatedUnion("mode", [
        z.strictObject({
          mode: z.literal("fixed"),
          percentageBps: z.number().int().min(1).max(10000),
          ...terms,
        }),
        z.strictObject({ mode: z.literal("client_proposed"), ...terms }),
      ])
      .nullable(),
  })
  .refine(
    (spec) => spec.cash !== null || spec.revenueShare !== null,
    "Offer at least one payment option.",
  );
export type CommercialOfferSpec = z.infer<typeof commercialOfferSpecSchema>;
export const publishCommercialOfferSchema = z
  .strictObject({
    sourceDraftId: z.uuid().optional(),
    sourceDraftVersion: z.number().int().positive().optional(),
    engagementId: z.uuid(),
    draft: draftSchema,
    spec: commercialOfferSpecSchema,
    expiresAt: z.iso.datetime(),
  })
  .superRefine(({ draft, spec, sourceDraftId, sourceDraftVersion }, ctx) => {
    if (Boolean(sourceDraftId) !== Boolean(sourceDraftVersion))
      ctx.addIssue({
        code: "custom",
        path: ["sourceDraftVersion"],
        message: "Supply the builder draft and version together.",
      });
    const recurring = draft.lines.filter((line) => line.recurrenceMonths > 0);
    if (
      spec.cash?.mode === "client_proposed" &&
      (!recurring.length ||
        recurring.some(
          (line) =>
            line.recurrenceMonths !== recurring[0].recurrenceMonths ||
            line.startDate !== recurring[0].startDate ||
            line.endDate !== recurring[0].endDate,
        ))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["draft", "lines"],
        message:
          "Client-proposed recurring fees require one shared interval and date range.",
      });
    }
  });
const binding = {
  offerId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
export const portalCommercialOfferCommandSchema = z.discriminatedUnion(
  "action",
  [
    z.strictObject({
      action: z.literal("select"),
      ...binding,
      option: z.enum(["cash", "revenue_share"]),
      recurringAmountMinor: money
        .refine(
          (value) => BigInt(value) >= BigInt(2000),
          "Recurring fees must be at least 2000 minor units.",
        )
        .optional(),
      percentageBps: z.number().int().min(1000).max(10000).optional(),
    }),
  ],
);
export const staffCommercialOfferCommandSchema = z.discriminatedUnion(
  "action",
  [
    publishCommercialOfferSchema.extend({ action: z.literal("publish") }),
    z.strictObject({ action: z.literal("withdraw"), ...binding }),
    z.strictObject({
      action: z.literal("reject"),
      ...binding,
      reason: z.string().trim().min(1).max(4000),
    }),
    z.strictObject({
      action: z.literal("approve"),
      ...binding,
      draft: draftSchema.optional(),
    }),
  ],
);
type OfferMutationCommand =
  | z.infer<typeof portalCommercialOfferCommandSchema>
  | Exclude<
      z.infer<typeof staffCommercialOfferCommandSchema>,
      { action: "publish" }
    >;
export type CommercialOfferMutation = {
  [Action in OfferMutationCommand["action"]]: Omit<
    Extract<OfferMutationCommand, { action: Action }>,
    "offerId" | "expectedVersion"
  >;
}[OfferMutationCommand["action"]];

export type CommercialOffer = {
  id: string;
  organisationId: string;
  engagementId: string;
  version: number;
  status:
    | "published"
    | "proposed"
    | "rejected"
    | "selected"
    | "withdrawn"
    | "expired";
  draft: AgreementDraft;
  spec: CommercialOfferSpec;
  expiresAt: string;
  selection: {
    option: "cash" | "revenue_share";
    recurringAmountMinor?: string;
    percentageBps?: number;
  } | null;
  rejectionReason: string | null;
  approvalId: string | null;
  agreementId: string | null;
};
export function recurringTotalMinor(draft: AgreementDraft): string {
  return draft.lines
    .filter((line) => line.recurrenceMonths > 0)
    .reduce((total, line) => total + BigInt(totalLinePence(line)), BigInt(0))
    .toString();
}
export function commercialSelectionDraft(
  draft: AgreementDraft,
  spec: CommercialOfferSpec,
  option: "cash" | "revenue_share",
  percentageBps?: number,
): AgreementDraft {
  if (option === "cash") {
    const { revenueShare: _share, ...cash } = draft;
    void _share;
    return draftSchema.parse(cash);
  }
  const share = spec.revenueShare;
  if (!share) throw new Error("Revenue share is unavailable.");
  const { mode: _mode, ...shareTerms } = share;
  void _mode;
  return draftSchema.parse({
    ...draft,
    revenueShare: {
      ...shareTerms,
      percentageBps:
        percentageBps ??
        (share.mode === "fixed" ? share.percentageBps : undefined),
    },
    lines: draft.lines.map((line) =>
      line.recurrenceMonths
        ? { ...line, unitPence: "0", discountPence: "0", taxPence: "0" }
        : line,
    ),
  });
}
