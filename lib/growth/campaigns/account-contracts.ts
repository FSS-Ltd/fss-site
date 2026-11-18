import { z } from "zod";

const text = z.string().trim().min(1).max(500);
const date = z.union([z.date(), z.iso.datetime()]).pipe(z.coerce.date());
const nullableCount = z.number().int().nonnegative().nullable();
const tier = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(100),
  z.literal(150),
]);
const base = {
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
};
const visibilitySchema = z.strictObject({
  source: text,
  reviewedAt: date,
  expiresAt: date,
  scope: text,
  paths: z.strictObject({
    mailbox: z.enum(["covered", "unknown"]),
    aliases: z.enum(["covered", "unknown"]),
    delegates: z.enum(["covered", "unknown"]),
    automatic: z.enum(["covered", "unknown"]),
  }),
  recipientHeaders: z.enum(["complete", "unknown"]),
});
export const limitsReviewSchema = z.strictObject({
  source: text,
  edition: text,
  path: text,
  observedAt: date,
  expiresAt: date,
  messages: z.number().int().positive(),
  recipients: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  perMessage: z.number().int().positive(),
  messageReserve: z.number().int().min(50),
  recipientReserve: z.number().int().nonnegative(),
  visibility: visibilitySchema.optional(),
});
export const healthReviewSchema = z.strictObject({
  source: text,
  observedFrom: date,
  observedUntil: date,
  expiresAt: date,
  complete: z.boolean(),
  verdict: z.enum(["healthy", "unhealthy", "unknown"]),
  sends: nullableCount,
  attempts: nullableCount,
  hardBounces: nullableCount,
  complaints: nullableCount,
  rateIncidents: nullableCount,
  authIncidents: nullableCount,
  authentication: z.strictObject({
    spf: z.strictObject({
      status: z.enum(["pass", "fail", "unknown"]),
      source: text,
    }),
    dkim: z.strictObject({
      status: z.enum(["pass", "fail", "unknown"]),
      source: text,
    }),
    dmarc: z.strictObject({
      status: z.enum(["pass", "fail", "unknown"]),
      source: text,
    }),
  }),
});
export const accountControlCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("record_limits"),
    ...base,
    evidence: limitsReviewSchema,
  }),
  z.strictObject({
    type: z.literal("record_health"),
    ...base,
    evidence: healthReviewSchema,
  }),
  z.strictObject({ type: z.literal("activate"), ...base }),
  z.strictObject({
    type: z.literal("revalidate_grant"),
    ...base,
    expectedGrantVersion: z.number().int().positive(),
  }),
  z.strictObject({ type: z.literal("approve_ramp"), ...base, ramp: tier }),
  z.strictObject({ type: z.literal("reduce_ramp"), ...base, ramp: tier }),
  z.strictObject({ type: z.literal("halt"), ...base, reason: text }),
]);
export type AccountControlCommand = z.infer<typeof accountControlCommandSchema>;
