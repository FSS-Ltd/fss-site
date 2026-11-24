import { z } from "zod";
import { parseGmailRecipients } from "../gmail/recipients";
import { parseGmailReferences } from "../../sequences/gmail-references";
import type { VerifyResendWebhookResult } from "./webhook";

const bindingSchema = z.strictObject({
  connectionId: z.uuid(),
  team: z.string().trim().min(1).max(200),
  environment: z.enum(["production", "preview", "development"]),
  sender: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  webhookGeneration: z.uuid(),
});
const eventSchema = z.object({
  type: z.literal("email.delivered"),
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({
    email_id: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
    message_id: z.string().min(1).max(998),
    from: z.string().min(1).max(1024),
    to: z.union([
      z.string().min(1).max(1024),
      z.tuple([z.string().min(1).max(1024)]),
    ]),
    cc: z.union([z.tuple([]), z.null()]).optional(),
    bcc: z.union([z.tuple([]), z.null()]).optional(),
    created_at: z.iso.datetime({ offset: true }).optional(),
  }),
});

export type ResendWebhookAccountBinding = z.input<typeof bindingSchema>;
export type ResendDeliveryCandidate = {
  connectionId: string;
  team: string;
  environment: "production" | "preview" | "development";
  webhookGeneration: string;
  providerEventId: string;
  bodySha256: string;
  providerMessageId: string;
  rfcMessageId: string;
  sender: string;
  recipient: string;
  providerEventCreatedAt: string;
  providerMessageCreatedAt: string | null;
};

/** A candidate is not a receipt. A caller must atomically match committed issuer evidence. */
export function extractResendDeliveryCandidate(input: {
  verified: VerifyResendWebhookResult;
  binding: ResendWebhookAccountBinding;
}): ResendDeliveryCandidate | null {
  if (
    !input.verified.ok ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(input.verified.providerEventId)
  )
    return null;
  const binding = bindingSchema.safeParse(input.binding);
  const event = eventSchema.safeParse(input.verified.payload);
  if (!binding.success || !event.success) return null;
  const from = parseGmailRecipients({
    to: event.data.data.from,
    cc: null,
    bcc: null,
  });
  const recipientValue = Array.isArray(event.data.data.to)
    ? event.data.data.to[0]
    : event.data.data.to;
  const to = parseGmailRecipients({ to: recipientValue, cc: null, bcc: null });
  const reference = parseGmailReferences(event.data.data.message_id, null);
  if (
    !from ||
    from.to.length !== 1 ||
    from.to[0] !== binding.data.sender ||
    !to ||
    to.to.length !== 1 ||
    reference.kind !== "valid" ||
    reference.ids.length !== 1 ||
    reference.ids[0] !== event.data.data.message_id
  )
    return null;
  return {
    connectionId: binding.data.connectionId,
    team: binding.data.team,
    environment: binding.data.environment,
    webhookGeneration: binding.data.webhookGeneration,
    providerEventId: input.verified.providerEventId,
    bodySha256: input.verified.bodySha256,
    providerMessageId: event.data.data.email_id,
    rfcMessageId: event.data.data.message_id,
    sender: from.to[0],
    recipient: to.to[0],
    providerEventCreatedAt: event.data.created_at,
    providerMessageCreatedAt: event.data.data.created_at ?? null,
  };
}
