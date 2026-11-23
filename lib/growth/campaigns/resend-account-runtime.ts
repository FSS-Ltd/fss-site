import { resendBindingSchema } from "./resend-account-readiness";
import type { ResendRuntimeConfiguration } from "./resend-account-control";

/** Reads server-only outreach credentials and their operator-managed generation IDs. */
export function readResendOutreachRuntime(
  env: Record<string, string | undefined> = process.env,
): ResendRuntimeConfiguration | null {
  const sender = env.RESEND_OUTREACH_FROM_EMAIL;
  const binding = resendBindingSchema.safeParse({
    team: env.RESEND_OUTREACH_TEAM,
    environment: env.RESEND_OUTREACH_ENVIRONMENT,
    sender,
    domain: sender?.split("@")[1],
    replyTo: env.RESEND_OUTREACH_REPLY_TO_EMAIL,
    sendGeneration: env.RESEND_OUTREACH_SEND_GENERATION,
    usageGeneration: env.RESEND_OUTREACH_USAGE_GENERATION,
    webhookGeneration: env.RESEND_OUTREACH_WEBHOOK_GENERATION,
  });
  const sendCredential = env.RESEND_OUTREACH_SEND_API_KEY;
  const usageCredential = env.RESEND_OUTREACH_USAGE_API_KEY;
  if (
    !binding.success ||
    !sendCredential?.trim() ||
    !usageCredential?.trim() ||
    (env.VERCEL_ENV !== undefined &&
      env.VERCEL_ENV !== binding.data.environment)
  )
    return null;
  const webhookSecret = env.RESEND_OUTREACH_WEBHOOK_SECRET;
  return {
    binding: binding.data,
    sendCredential,
    usageCredential,
    ...(webhookSecret?.trim() ? { webhookSecret } : {}),
  };
}
