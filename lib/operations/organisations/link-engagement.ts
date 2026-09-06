import { z } from "zod";
import type { OperationsFounder, ReviewedMapping } from "./types";

const mappingSchema = z
  .strictObject({
    reviewReference: z.string().trim().min(1).max(200),
    organisations: z
      .array(
        z.strictObject({
          id: z.uuid().transform((value) => value.toLowerCase()),
          legalName: z.string().trim().min(1).max(200),
          displayName: z.string().trim().min(1).max(200),
          tradingStatus: z.enum(["active", "inactive", "unknown"]),
          timezone: z
            .string()
            .max(100)
            .refine((value) => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: value });
                return true;
              } catch {
                return false;
              }
            }),
          engagementIds: z
            .array(z.uuid().transform((value) => value.toLowerCase()))
            .min(1)
            .max(100),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((mapping, context) => {
    const organisations = new Set<string>();
    const engagements = new Set<string>();
    for (const organisation of mapping.organisations) {
      if (organisations.has(organisation.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate organisation ID.",
        });
      organisations.add(organisation.id);
      for (const id of organisation.engagementIds) {
        if (engagements.has(id))
          context.addIssue({
            code: "custom",
            message: "Each engagement must appear exactly once.",
          });
        engagements.add(id);
      }
    }
  });

export function parseReviewedMapping(input: unknown): ReviewedMapping {
  return mappingSchema.parse(input);
}

// Context is supplied only by the verified founder guard or the local operator
// command using dedicated credentials. Never construct it from request JSON.
export function requireOperationsFounder(
  context: OperationsFounder | null,
): OperationsFounder {
  if (!context || !/^[a-f0-9]{64}$/.test(context.actorId)) {
    throw new Error("Founder authorization is required.");
  }
  return context;
}
