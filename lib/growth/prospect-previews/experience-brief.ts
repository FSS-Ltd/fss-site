import { z } from "zod";

const rawReferencePattern =
  /(?:https?:\/\/|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b)/i;

const briefText = (minimum: number, maximum: number) =>
  z
    .string()
    .min(minimum)
    .max(maximum)
    .refine((value) => value === value.trim(), "Text cannot have outer whitespace.")
    .refine(
      (value) => !rawReferencePattern.test(value),
      "Text cannot include a raw URL or email address.",
    );

const opaqueAssetIdSchema = z.string().uuid();

const journeyFieldSchema = z.enum([
  "registration",
  "service",
  "need",
  "timing",
  "notes",
  "contact",
]);

const journeyStepKindSchema = z.enum([
  "vehicle-registration",
  "service-selection",
  "needs-selection",
  "timing",
  "notes",
  "contact-details",
  "review",
]);

const journeyControlSchema = z.enum([
  "registration",
  "single-select",
  "multi-select",
  "textarea",
  "contact-details",
  "review",
]);

const selectableControls = new Set(["single-select", "multi-select"]);

export const prospectPreviewJourneyStepSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[a-z][a-z0-9-]{0,39}$/,
        "Journey step identifiers must be lowercase URL-safe words.",
      ),
    label: briefText(1, 140),
    kind: journeyStepKindSchema,
    control: journeyControlSchema,
    requiredFields: z.array(journeyFieldSchema).max(4),
    options: z.array(briefText(1, 120)).max(8),
  })
  .strict()
  .superRefine((step, context) => {
    if (selectableControls.has(step.control) && step.options.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selectable journey controls require researched options.",
        path: ["options"],
      });
    }

    if (!selectableControls.has(step.control) && step.options.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only selectable journey controls can include options.",
        path: ["options"],
      });
    }

    if (
      step.kind === "vehicle-registration" &&
      (step.control !== "registration" ||
        !step.requiredFields.includes("registration"))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Vehicle registration steps must use the registration control and require a registration.",
        path: ["control"],
      });
    }

    if (
      step.kind === "review" &&
      (step.control !== "review" || step.requiredFields.length > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Review steps must use the review control without required fields.",
        path: ["control"],
      });
    }
  });

export const prospectPreviewHeroEvidenceSchema = z
  .object({
    statement: briefText(12, 300),
    supportingStatement: briefText(12, 500),
    evidenceIds: z.array(opaqueAssetIdSchema).min(1).max(4),
  })
  .strict();

export const prospectPreviewVisualBriefSchema = z
  .object({
    brandColors: z
      .array(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour."))
      .min(1)
      .max(4),
    colourEvidenceIds: z.array(opaqueAssetIdSchema).min(1).max(4),
    logoEvidenceId: opaqueAssetIdSchema.nullable(),
    logoAssetId: opaqueAssetIdSchema.nullable(),
    onSiteImageEvidenceId: opaqueAssetIdSchema.nullable(),
    onSiteImageAssetId: opaqueAssetIdSchema.nullable(),
    approvedHeroMediaAssetId: opaqueAssetIdSchema.nullable(),
  })
  .strict()
  .superRefine((visual, context) => {
    if (visual.logoAssetId !== null && visual.logoEvidenceId === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A logo asset requires first-party logo evidence.",
        path: ["logoEvidenceId"],
      });
    }

    if (
      visual.onSiteImageAssetId !== null &&
      visual.onSiteImageEvidenceId === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An on-site image asset requires first-party image evidence.",
        path: ["onSiteImageEvidenceId"],
      });
    }
  });

export const experienceBriefSchema = z
  .object({
    schemaVersion: z.literal("1.1"),
    hero: prospectPreviewHeroEvidenceSchema,
    journey: z
      .object({
        title: briefText(4, 160),
        primaryCta: briefText(2, 120),
        completionMessage: briefText(4, 220),
        steps: z.array(prospectPreviewJourneyStepSchema).min(2).max(7),
      })
      .strict()
      .superRefine((journey, context) => {
        const stepIds = new Set(journey.steps.map((step) => step.id));
        if (stepIds.size !== journey.steps.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Journey steps must have unique identifiers.",
            path: ["steps"],
          });
        }

        if (journey.steps.at(-1)?.kind !== "review") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A prospect journey must finish with a review step.",
            path: ["steps"],
          });
        }
      }),
    visual: prospectPreviewVisualBriefSchema,
  })
  .strict();

export type ExperienceBrief = z.infer<typeof experienceBriefSchema>;

export function parseExperienceBrief(value: unknown): ExperienceBrief {
  return experienceBriefSchema.parse(value);
}
