import { z } from "zod";
import { healthReviewSchema } from "./account-contracts";

const identityText = z.string().trim().min(1).max(200);
export const resendBindingSchema = z
  .strictObject({
    team: identityText,
    environment: z.enum(["production", "preview", "development"]),
    sender: z.email().max(320).toLowerCase(),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .max(253)
      .regex(
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/,
      ),
    replyTo: z.email().max(320).toLowerCase(),
    sendGeneration: z.uuid(),
    usageGeneration: z.uuid(),
    webhookGeneration: z.uuid().optional(),
  })
  .refine((value) => value.sender.split("@")[1] === value.domain);
export type ResendBinding = z.infer<typeof resendBindingSchema>;

const count = z.number().int().nonnegative().safe();
const usageWindow = z
  .object({
    used: count,
    sent: count,
    received: count,
    limit: count.nullable(),
    resets_at: z.iso.datetime({ offset: true }),
  })
  .refine((value) => value.used === value.sent + value.received);
const usageSchema = z.object({
  observedAt: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  daily: usageWindow,
  monthly: usageWindow,
  rateLimit: z.object({
    limit: z.number().int().positive().safe(),
    duration: z.string().regex(/^[1-9][0-9]{0,8}ms$/),
  }),
});

export type ResendReadinessInput = {
  binding: unknown;
  runtimeBinding: unknown;
  state: string;
  health: unknown;
  usage: unknown;
  usageGeneration: string | null;
  sendCredential: string;
  usageCredential: string;
  monitoredMailbox: boolean;
};

export function assessResendAccountReadiness(
  input: ResendReadinessInput,
  now: Date,
  mode: "active" | "prerequisites" = "active",
): { status: "ready"; expiresAt: Date } | { status: "held"; reason: string } {
  const held = (reason: string) => ({ status: "held" as const, reason });
  if (!Number.isFinite(now.getTime())) return held("invalid_time");
  const reviewed = resendBindingSchema.safeParse(input.binding);
  const runtime = resendBindingSchema.safeParse(input.runtimeBinding);
  if (
    !reviewed.success ||
    !runtime.success ||
    Object.keys(reviewed.data).some(
      (key) =>
        reviewed.data[key as keyof ResendBinding] !==
        runtime.data[key as keyof ResendBinding],
    ) ||
    input.usageGeneration !== reviewed.data.usageGeneration ||
    !input.sendCredential.trim() ||
    !input.usageCredential.trim() ||
    !input.monitoredMailbox
  )
    return held("identity_or_configuration_unknown");
  if (mode === "active" && input.state !== "active")
    return held("account_not_active");
  const health = healthReviewSchema.safeParse(input.health);
  if (!health.success) return held("health_unknown");
  const h = health.data;
  if (
    !h.complete ||
    h.verdict !== "healthy" ||
    h.observedFrom >= h.observedUntil ||
    h.observedUntil > now ||
    h.observedUntil.getTime() < now.getTime() - 86400000 ||
    h.expiresAt <= now ||
    h.expiresAt.getTime() > h.observedUntil.getTime() + 86400000 ||
    h.sends === null ||
    h.sends <= 0 ||
    h.attempts === null ||
    h.attempts < h.sends ||
    h.hardBounces !== 0 ||
    h.complaints !== 0 ||
    h.rateIncidents !== 0 ||
    h.authIncidents !== 0 ||
    Object.values(h.authentication).some(
      (entry) => entry.status !== "pass" || !entry.source.trim(),
    )
  )
    return held("health_unknown");
  const parsed = usageSchema.safeParse(input.usage);
  if (!parsed.success) return held("usage_unknown");
  const u = parsed.data;
  const observed = Date.parse(u.observedAt);
  const expiry = Date.parse(u.validUntil);
  const deadline = Math.min(
    observed + 300000,
    Date.parse(u.daily.resets_at),
    Date.parse(u.monthly.resets_at),
  );
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(expiry) ||
    observed > now.getTime() ||
    expiry <= now.getTime() ||
    expiry > deadline
  )
    return held("usage_unknown");
  if (
    (u.daily.limit !== null && u.daily.used >= u.daily.limit) ||
    (u.monthly.limit !== null && u.monthly.used >= u.monthly.limit)
  )
    return held("quota_exhausted");
  return {
    status: "ready",
    expiresAt: new Date(Math.min(expiry, h.expiresAt.getTime())),
  };
}
