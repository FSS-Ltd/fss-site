import { z } from "zod";

export const isoDateSchema = z.preprocess(
  (value) =>
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.toISOString().slice(0, 10)
      : value,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Expected a valid ISO calendar date."),
);

export const contentEvidenceSchema = z.object({
  modifiedDate: isoDateSchema,
  indexable: z.boolean().default(true),
  authorUrl: z.string().url().optional(),
  reviewedBy: z.string().min(1).optional(),
  reviewedDate: isoDateSchema.optional(),
  audience: z.array(z.string().min(1)).optional(),
  summary: z.string().min(1).optional(),
  sources: z
    .array(z.object({ title: z.string().min(1), url: z.string().url() }))
    .optional(),
});

export type ContentEvidence = z.infer<typeof contentEvidenceSchema>;
