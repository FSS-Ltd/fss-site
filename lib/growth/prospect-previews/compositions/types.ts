import { createHash } from "node:crypto";

import { z } from "zod";

import {
  prospectPreviewHeroEvidenceSchema,
  prospectPreviewJourneyStepSchema,
  prospectPreviewVisualBriefSchema,
} from "../experience-brief";
import { prospectPreviewAssessmentSectionSchema } from "../types";

const compositionText = (minimum: number, maximum: number) =>
  z
    .string()
    .min(minimum)
    .max(maximum)
    .refine((value) => value === value.trim(), "Text cannot have outer whitespace.")
    .refine(
      (value) => !/(?:https?:\/\/|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b)/i.test(value),
      "Text cannot include a raw URL or email address.",
    );

const compositionSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain lowercase URL-safe words separated by hyphens.",
  )
  .max(120);

export const prospectPreviewFamilySchema = z.enum([
  "automotive",
  "property-trades",
  "hospitality",
  "property",
  "professional-services",
]);

export const previewVisualDirectionSchema = z.enum([
  "precision-dark",
  "warm-editorial",
  "calm-architectural",
  "local-service",
  "considered-ledger",
]);

export const previewHeroTreatmentSchema = z.enum([
  "workshop-geometry",
  "service-map",
  "crafted-table",
  "property-frame",
  "ledger-grid",
  "local-silhouette",
]);

export const previewSectionSchema = z.enum([
  "hero",
  "proof",
  "services",
  "case-for-change",
  "journey",
  "locality",
  "owner-cta",
]);

const legacyPreviewJourneySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("mot-request"),
      completionMessage: compositionText(1, 220),
    })
    .strict(),
  z
    .object({
      type: z.literal("quote-request"),
      completionMessage: compositionText(1, 220),
    })
    .strict(),
  z
    .object({
      type: z.literal("table-enquiry"),
      completionMessage: compositionText(1, 220),
    })
    .strict(),
  z
    .object({
      type: z.literal("valuation-request"),
      completionMessage: compositionText(1, 220),
    })
    .strict(),
  z
    .object({
      type: z.literal("consultation-request"),
      completionMessage: compositionText(1, 220),
    })
    .strict(),
]);

const evidenceBackedPreviewJourneySchema = z
  .object({
    type: z.literal("evidence-backed"),
    title: compositionText(4, 160),
    primaryCta: compositionText(2, 120),
    completionMessage: compositionText(4, 220),
    steps: z.array(prospectPreviewJourneyStepSchema).min(2).max(7),
  })
  .strict();

const prospectPreviewCompositionFields = {
  prospectId: z.string().uuid(),
  slug: compositionSlugSchema,
  family: prospectPreviewFamilySchema,
  visualDirection: previewVisualDirectionSchema,
  heroTreatment: previewHeroTreatmentSchema,
  sectionOrder: z.array(previewSectionSchema).min(5).max(7),
  copy: z
    .object({
      businessName: compositionText(1, 200),
      locality: compositionText(1, 160),
      headline: compositionText(1, 300),
      primaryCta: compositionText(1, 500),
    })
    .strict(),
  content: z
    .object({
      businessGoal: compositionText(1, 2_000),
      homepageSections: prospectPreviewAssessmentSectionSchema,
      conversionPlan: prospectPreviewAssessmentSectionSchema,
      trustSignals: prospectPreviewAssessmentSectionSchema,
    })
    .strict(),
};

function validateSectionOrder(
  value: { sectionOrder: readonly z.infer<typeof previewSectionSchema>[] },
  context: z.RefinementCtx,
): void {
  const uniqueSections = new Set(value.sectionOrder);
  if (uniqueSections.size !== value.sectionOrder.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Section order cannot repeat a section.",
      path: ["sectionOrder"],
    });
  }

  for (const requiredSection of ["hero", "journey", "owner-cta"] as const) {
    if (!uniqueSections.has(requiredSection)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Section order must contain ${requiredSection}.`,
        path: ["sectionOrder"],
      });
    }
  }
}

const prospectPreviewCompositionV1BaseSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    ...prospectPreviewCompositionFields,
    journey: legacyPreviewJourneySchema,
  })
  .strict()
  .superRefine(validateSectionOrder);

const prospectPreviewCompositionV11BaseSchema = z
  .object({
    schemaVersion: z.literal("1.1"),
    ...prospectPreviewCompositionFields,
    journey: evidenceBackedPreviewJourneySchema,
    hero: prospectPreviewHeroEvidenceSchema,
    visual: prospectPreviewVisualBriefSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateSectionOrder(value, context);
    if (value.copy.headline !== value.hero.statement) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence-backed composition headlines must use the hero statement.",
        path: ["copy", "headline"],
      });
    }
    if (value.copy.primaryCta !== value.journey.primaryCta) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence-backed composition CTA must use the researched journey CTA.",
        path: ["copy", "primaryCta"],
      });
    }
  });

const prospectPreviewCompositionBaseSchema = z.discriminatedUnion(
  "schemaVersion",
  [
    prospectPreviewCompositionV1BaseSchema,
    prospectPreviewCompositionV11BaseSchema,
  ],
);

export const prospectPreviewCompositionSchema =
  z.discriminatedUnion("schemaVersion", [
    prospectPreviewCompositionV1BaseSchema.extend({
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    prospectPreviewCompositionV11BaseSchema.extend({
      digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ]);

export type ProspectPreviewComposition = z.infer<
  typeof prospectPreviewCompositionSchema
>;

function canonicalComposition(
  value: z.output<typeof prospectPreviewCompositionBaseSchema>,
): z.output<typeof prospectPreviewCompositionBaseSchema> {
  if (value.schemaVersion === "1.1") {
    return {
      schemaVersion: value.schemaVersion,
      prospectId: value.prospectId,
      slug: value.slug,
      family: value.family,
      visualDirection: value.visualDirection,
      heroTreatment: value.heroTreatment,
      sectionOrder: [...value.sectionOrder],
      journey: value.journey,
      copy: value.copy,
      content: value.content,
      hero: value.hero,
      visual: value.visual,
    };
  }

  return {
    schemaVersion: value.schemaVersion,
    prospectId: value.prospectId,
    slug: value.slug,
    family: value.family,
    visualDirection: value.visualDirection,
    heroTreatment: value.heroTreatment,
    sectionOrder: [...value.sectionOrder],
    journey: value.journey,
    copy: value.copy,
    content: value.content,
  };
}

export function buildCompositionDigest(
  value: unknown,
): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Prospect preview composition must be an object.");
  }

  const draft = { ...(value as Record<string, unknown>) };
  delete draft.digest;
  const parsed = prospectPreviewCompositionBaseSchema.parse(draft);
  return createHash("sha256")
    .update(JSON.stringify(canonicalComposition(parsed)))
    .digest("hex");
}

export function buildCompositionFingerprint(
  value: ProspectPreviewComposition,
): string {
  const composition = prospectPreviewCompositionSchema.parse(value);
  return createHash("sha256")
    .update(
      JSON.stringify({
        visualDirection: composition.visualDirection,
        heroTreatment: composition.heroTreatment,
        sectionOrder: composition.sectionOrder,
        journeyType: composition.journey.type,
      }),
    )
    .digest("hex");
}

export function validateProspectPreviewComposition(
  value: unknown,
): ProspectPreviewComposition {
  const composition = prospectPreviewCompositionSchema.parse(value);
  if (composition.digest !== buildCompositionDigest(composition)) {
    throw new TypeError("Prospect preview composition digest does not match.");
  }
  return composition;
}
