import { z } from "zod";
import { parseGmailRecipients } from "../gmail/recipients";
import { parseGmailReferences } from "../../sequences/gmail-references";
import type {
  ResendDeliveryCandidate,
  ResendWebhookAccountBinding,
} from "./outreach-delivery-evidence";
import type { VerifyResendWebhookResult } from "./webhook";

const eventSchema = z.object({
  type: z.enum(["email.bounced", "email.complained"]),
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
    bounce: z.object({ type: z.string().optional() }).optional(),
  }),
});
export type AdverseClassification =
  | { kind: "ignored" }
  | { kind: "invalid" }
  | {
      kind: "adverse";
      eventType: "email.bounced" | "email.complained";
      reason: "bounce" | "do_not_contact";
      candidate: ResendDeliveryCandidate;
    };

/** Parser only: the caller must independently verify the raw Svix signature. */
export function classifyResendOutreachAdverse(
  verified: VerifyResendWebhookResult,
  binding: ResendWebhookAccountBinding,
): AdverseClassification {
  if (!verified.ok || !/^[A-Za-z0-9_-]{1,256}$/.test(verified.providerEventId))
    return { kind: "invalid" };
  const parsed = eventSchema.safeParse(verified.payload);
  if (!parsed.success) return { kind: "invalid" };
  const { type, created_at: occurredAt, data } = parsed.data;
  if (type === "email.bounced" && data.bounce?.type !== "Permanent")
    return { kind: "ignored" };
  const from = parseGmailRecipients({ to: data.from, cc: null, bcc: null });
  const to = parseGmailRecipients({
    to: Array.isArray(data.to) ? data.to[0] : data.to,
    cc: null,
    bcc: null,
  });
  const rfc = parseGmailReferences(data.message_id, null);
  if (
    !from ||
    from.to.length !== 1 ||
    from.to[0] !== binding.sender ||
    !to ||
    to.to.length !== 1 ||
    rfc.kind !== "valid" ||
    rfc.ids.length !== 1 ||
    rfc.ids[0] !== data.message_id
  )
    return { kind: "invalid" };
  return {
    kind: "adverse",
    eventType: type,
    reason: type === "email.bounced" ? "bounce" : "do_not_contact",
    candidate: {
      connectionId: binding.connectionId,
      team: binding.team,
      environment: binding.environment,
      webhookGeneration: binding.webhookGeneration,
      providerEventId: verified.providerEventId,
      bodySha256: verified.bodySha256,
      providerMessageId: data.email_id,
      rfcMessageId: data.message_id,
      sender: from.to[0],
      recipient: to.to[0],
      providerEventCreatedAt: occurredAt,
      providerMessageCreatedAt: data.created_at ?? null,
    },
  };
}
