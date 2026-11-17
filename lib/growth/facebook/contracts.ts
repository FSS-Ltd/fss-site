import { isIP } from "node:net";
import { z } from "zod";
import { sourceLeadInputSchema } from "../campaigns/schemas";

const uuid = z.uuid();
const date = z.coerce.date();
const text = z.string().trim().min(1).max(2000);
const publicUrl = z.url().refine((value) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    host.includes(".") &&
    !isIP(host) &&
    ![".localhost", ".local", ".internal", ".test"].some((suffix) =>
      host.endsWith(suffix),
    )
  );
});
const facebookUrl = publicUrl.refine((value) => {
  const host = new URL(value).hostname.toLowerCase();
  return host === "facebook.com" || host.endsWith(".facebook.com");
});
const observation = z
  .object({ sourceUrl: publicUrl, summary: text, observedAt: date })
  .strict();
const destination = z
  .object({
    url: facebookUrl,
    name: text.max(200),
    kind: z.enum(["page", "group"]),
    locality: z.string().trim().max(200).nullable(),
    websiteUrl: publicUrl.nullable(),
    observation,
  })
  .strict();
export const facebookCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("capture_destination"),
      requestId: uuid,
      destination,
    })
    .strict(),
  z
    .object({
      type: z.literal("review_rules"),
      requestId: uuid,
      destinationId: uuid,
      expectedVersion: z.number().int().positive(),
      sourceUrl: publicUrl,
      summary: text,
      observedAt: date,
      expiresAt: date,
      decision: z.enum(["allowed", "prohibited", "unknown"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("record_activity"),
      requestId: uuid,
      destinationId: uuid,
      activity: z.enum(["followed", "joined", "posted"]),
      occurredAt: date,
      evidenceUrl: publicUrl.nullable(),
      prospectId: uuid.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("capture_source"),
      requestId: uuid,
      destinationId: uuid,
      source: z.strictObject(sourceLeadInputSchema.shape),
    })
    .strict(),
  z
    .object({
      type: z.literal("link_prospect"),
      requestId: uuid,
      destinationId: uuid,
      prospectId: uuid,
    })
    .strict(),
  z
    .object({
      type: z.literal("allocate_pilot"),
      requestId: uuid,
      prospectId: uuid,
      expectedVersion: z.number().int().positive(),
    })
    .strict(),
]);
export type FacebookCommand = z.infer<typeof facebookCommandSchema>;
export const facebookDiscoveryBatchSchema = z
  .object({
    version: z.literal(1),
    purpose: z.literal("facebook_public_discovery"),
    externalRunId: z.string().trim().min(1).max(200),
    observedAt: date,
    observations: z.array(destination).max(10),
  })
  .strict();
export type FacebookDiscoveryBatch = z.infer<
  typeof facebookDiscoveryBatchSchema
>;
export type RulesReview = {
  decision: "allowed" | "prohibited" | "unknown";
  observedAt: Date;
  expiresAt: Date;
};
export function derivePostReadiness(
  review: RulesReview | null,
  latestObservation: Date | null,
  now: Date,
): "allowed" | "unknown" | "stale" | "prohibited" {
  if (!review || review.decision === "unknown") return "unknown";
  if (
    review.expiresAt <= now ||
    (latestObservation && latestObservation > review.observedAt)
  )
    return "stale";
  return review.decision;
}
