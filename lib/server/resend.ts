import "server-only";

import { toPlainText } from "@react-email/render";

import { createResendClient, type ResendMessage } from "@/lib/growth/integrations/resend/client";

type SendResendEmailParams = {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

const FOUNDER_REPLY_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const LEGACY_CATEGORY: ResendMessage["category"] = "site-enquiry";

function isValidReplyTo(value: string): boolean {
  const plainEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailPattern = /^.+<\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*>$/;

  return plainEmailPattern.test(value) || namedEmailPattern.test(value);
}

/**
 * Compatibility wrapper around the typed ResendGateway (lib/growth/integrations/resend/client.ts)
 * so existing callers can keep their current signature until they migrate to the gateway directly.
 */
export async function sendResendEmail(params: SendResendEmailParams): Promise<string> {
  const replyTo = params.replyTo?.trim();
  const shouldUseProvidedReplyTo = replyTo ? isValidReplyTo(replyTo) : false;

  if (replyTo && !shouldUseProvidedReplyTo) {
    console.warn("Resend reply-to is invalid. Falling back to the founder reply address.");
  }

  const message: ResendMessage = {
    idempotencyKey: crypto.randomUUID(),
    category: LEGACY_CATEGORY,
    from: params.from,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    replyTo: shouldUseProvidedReplyTo ? replyTo! : FOUNDER_REPLY_EMAIL,
    subject: params.subject,
    html: params.html,
    text: toPlainText(params.html),
  };

  const result = await createResendClient(params.apiKey).send(message);
  return result.providerMessageId;
}
