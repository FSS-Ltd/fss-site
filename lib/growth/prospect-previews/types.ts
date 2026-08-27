import { z } from "zod";

import { experienceBriefSchema } from "./experience-brief";

function exactText(minimum: number, maximum: number) {
  return z
    .string()
    .min(minimum)
    .max(maximum)
    .refine((value) => value === value.trim(), "Text cannot have outer whitespace.");
}

export const prospectPreviewStatusSchema = z.enum([
  "draft",
  "published",
  "withdrawn",
]);

export type ProspectPreviewStatus = z.infer<typeof prospectPreviewStatusSchema>;

export const prospectPreviewAssessmentSectionSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    summary: exactText(1, 2_000),
    items: z.array(exactText(1, 1_000)).min(1).max(30),
  })
  .strict();

const storedProspectPreviewSnapshotFields = {
  businessName: exactText(1, 200),
  sector: exactText(1, 160),
  locality: exactText(1, 160),
  businessGoal: exactText(1, 2_000),
  primaryCta: exactText(1, 500),
  homepageSections: prospectPreviewAssessmentSectionSchema,
  conversionPlan: prospectPreviewAssessmentSectionSchema,
  trustSignals: prospectPreviewAssessmentSectionSchema,
};

const storedProspectPreviewSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    ...storedProspectPreviewSnapshotFields,
  })
  .strict();

const storedProspectPreviewSnapshotV11Schema = z
  .object({
    schemaVersion: z.literal("1.1"),
    ...storedProspectPreviewSnapshotFields,
    experienceBrief: experienceBriefSchema,
  })
  .strict();

export const storedProspectPreviewSnapshotSchema = z.discriminatedUnion(
  "schemaVersion",
  [
    storedProspectPreviewSnapshotV1Schema,
    storedProspectPreviewSnapshotV11Schema,
  ],
);

export type StoredProspectPreviewSnapshot = z.infer<
  typeof storedProspectPreviewSnapshotSchema
>;

export const PROSPECT_PREVIEW_PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function parseStoredProspectPreviewSnapshot(
  value: unknown,
): StoredProspectPreviewSnapshot {
  return storedProspectPreviewSnapshotSchema.parse(value);
}
