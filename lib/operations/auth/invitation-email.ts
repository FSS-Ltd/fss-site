import { z } from "zod";
import {
  createResendClient,
  type ResendGateway,
} from "@/lib/growth/integrations/resend/client";
import {
  OPERATIONS_EMAIL_ADDRESS,
  OPERATIONS_EMAIL_FROM,
} from "../email-identity";

export type PortalInvitationEmail = Readonly<{
  to: string;
  activationUrl: string;
  idempotencyKey: string;
}>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Our own invitation email, so the link opens the portal instead of Clerk's ticket endpoint. */
export async function sendPortalInvitationEmail(
  email: PortalInvitationEmail,
  gateway: ResendGateway,
): Promise<void> {
  const href = escapeHtml(email.activationUrl);
  await gateway.send({
    idempotencyKey: email.idempotencyKey,
    category: "portal-invitation",
    from: OPERATIONS_EMAIL_FROM,
    to: email.to,
    replyTo: OPERATIONS_EMAIL_ADDRESS,
    subject: "Your FSS portal invitation",
    html: `<p>Hello,</p><p>Faithful Software Solutions has invited you to the FSS portal.</p><p><a href="${href}" style="text-decoration:underline;">Accept your invitation</a></p><p>If the link does not open, copy and paste this link into your browser:</p><p style="overflow-wrap:anywhere;word-break:break-all;">${href}</p><p>This link works for 30 days. If you received older invitation emails from FSS, use this one. Older links no longer work.</p><p>Questions? Reply to this email.</p>`,
    text: `Hello,\n\nFaithful Software Solutions has invited you to the FSS portal.\n\nAccept your invitation: ${email.activationUrl}\n\nThis link works for 30 days. If you received older invitation emails from FSS, use this one. Older links no longer work.\n\nQuestions? Reply to this email.`,
  });
}

export async function deliverPortalInvitationEmail(
  email: PortalInvitationEmail,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<void> {
  const key = z
    .string()
    .regex(/^re_[A-Za-z0-9_]+$/)
    .safeParse(env.OPERATIONS_RESEND_API_KEY);
  if (!key.success)
    throw new Error("Portal invitation email is not configured.");
  await sendPortalInvitationEmail(email, createResendClient(key.data));
}
