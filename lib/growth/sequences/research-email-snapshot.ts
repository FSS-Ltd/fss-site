import { createHash } from "node:crypto";
import { z } from "zod";
import { globalFirstEmailSchema } from "../research/global-schema";

export const researchOutreachPermissionSchema = z
  .object({
    basis: z.enum(["corporate_legitimate_interests", "consent"]),
    evidence: z.string().trim().min(10).max(2000),
  })
  .strict();

export const researchEmailSnapshotSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    reviewState: z.enum(["research_only", "approved", "provider_draft"]),
    email: globalFirstEmailSchema,
    draftVersion: z.number().int().positive().max(100).default(1),
    emailRevisions: z
      .array(
        z
          .object({
            version: z.number().int().positive(),
            editorActorId: z.string().regex(/^[0-9a-f]{64}$/),
            editedAt: z.iso.datetime({ offset: true }),
            email: globalFirstEmailSchema,
          })
          .strict(),
      )
      .max(99)
      .default([]),
    outreachApproval: researchOutreachPermissionSchema
      .extend({
        actorId: z.string().regex(/^[0-9a-f]{64}$/),
        approvedAt: z.iso.datetime({ offset: true }),
        fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .optional(),
  })
  .strict();

export type ResearchEmailSnapshot = z.infer<typeof researchEmailSnapshotSchema>;
export function isResearchEmailSnapshot(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === "2.0"
  );
}

export function researchEmailFingerprint(
  snapshot: ResearchEmailSnapshot,
  recipient: string,
  prospectVersion: number,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        email: snapshot.email,
        version: snapshot.draftVersion,
        recipient,
        prospectVersion,
      }),
    )
    .digest("hex");
}
