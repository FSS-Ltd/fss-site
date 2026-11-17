import { z } from "zod";
import type { ReadyWorkspace } from "./types";

// Validate transport values; readiness remains the server reader's decision.
const timestamp = z.iso.datetime({ offset: true });
const version = z.number().int().positive();
const publicUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
  );
});
const observation = z.object({
  id: z.string(),
  destinationId: z.string(),
  sourceUrl: publicUrl,
  summary: z.string(),
  observedAt: timestamp,
  createdAt: timestamp,
  provenance: z.enum(["founder", "signed_agent"]),
});
const review = z.object({
  id: z.string(),
  destinationId: z.string(),
  sourceUrl: publicUrl,
  summary: z.string(),
  actorId: z.string(),
  createdAt: timestamp,
  reviewedVersion: version,
  observedAt: timestamp,
  expiresAt: timestamp,
  decision: z.enum(["allowed", "prohibited", "unknown"]),
});
const activity = z.object({
  id: z.string(),
  destinationId: z.string(),
  activity: z.enum(["followed", "joined", "posted"]),
  occurredAt: timestamp,
  evidenceUrl: publicUrl.nullable(),
  prospectId: z.string().nullable(),
});
const destination = z.object({
  id: z.string(),
  url: publicUrl,
  name: z.string(),
  kind: z.enum(["page", "group"]),
  locality: z.string().nullable(),
  websiteUrl: publicUrl.nullable(),
  version,
  observations: z.array(observation),
  observationsHaveMore: z.boolean(),
  latestObservation: observation.nullable(),
  review: review.nullable(),
  postReadiness: z.enum(["allowed", "unknown", "stale", "prohibited"]),
  activities: z.array(activity),
  activitiesHaveMore: z.boolean(),
  prospects: z.array(
    z.object({
      destinationId: z.string(),
      prospectId: z.string(),
      name: z.string(),
      version,
    }),
  ),
  prospectsHaveMore: z.boolean(),
  nextManualAction: z.enum(["follow", "join", "review_rules", "post"]),
});
export const workspaceDtoSchema = z.object({
  status: z.literal("ready"),
  destinations: z.array(destination),
  nextCursor: z.string().nullable(),
  historyLimit: z.literal(20),
  pilots: z.object({
    total: z.literal(2),
    used: z.number(),
    remaining: z.number(),
    allocations: z.array(
      z.object({
        slot: z.number(),
        prospectId: z.string(),
        businessId: z.string(),
        name: z.string(),
        previewStatus: z.string().nullable(),
      }),
    ),
  }),
}) satisfies z.ZodType<ReadyWorkspace>;
export async function readWorkspace(
  query: string,
  signal: AbortSignal,
): Promise<ReadyWorkspace> {
  const response = await fetch(`/api/growth/facebook${query}`, {
    signal,
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("auth");
  if (!response.ok) throw new Error("read");
  const data: unknown = await response.json();
  const result = workspaceDtoSchema.safeParse(data);
  if (!result.success) throw new Error("read");
  return result.data;
}
