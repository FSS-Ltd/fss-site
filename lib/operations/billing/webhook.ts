import { createHash } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import type { BillingMode } from "./types";
import type { BillingEventReceipt } from "./events";

const envelope = z.object({
  id: z
    .string()
    .regex(/^evt_[A-Za-z0-9]+$/)
    .max(255),
  object: z.literal("event"),
  type: z.string().min(1).max(200),
  account: z.string().optional(),
  livemode: z.boolean(),
  created: z.number().int().nonnegative().max(253402300799),
  data: z.object({
    object: z.object({
      id: z
        .string()
        .regex(/^[A-Za-z0-9_]+$/)
        .max(255),
    }),
  }),
});

export function verifyBillingWebhook(
  rawBody: Uint8Array,
  signature: string | null,
  configuration: { secret: string; accountId: string; mode: BillingMode },
  receivedAt = Date.now(),
): BillingEventReceipt | null {
  if (
    !signature ||
    signature.length > 4096 ||
    !configuration.secret.startsWith("whsec_")
  )
    return null;
  try {
    const verified = Stripe.webhooks.constructEvent(
      rawBody,
      signature,
      configuration.secret,
      300,
      undefined,
      receivedAt,
    );
    const event = envelope.parse(verified);
    if (
      event.livemode !== (configuration.mode === "live") ||
      (event.account && event.account !== configuration.accountId)
    )
      return null;
    // Own-account snapshot events omit account. The endpoint secret binds receipt
    // to its configured account; the worker verifies ownership again via Stripe.
    return {
      accountId: configuration.accountId,
      mode: configuration.mode,
      eventId: event.id,
      eventType: event.type,
      objectId: event.data.object.id,
      payloadHash: createHash("sha256").update(rawBody).digest("hex"),
      occurredAt: new Date(event.created * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
