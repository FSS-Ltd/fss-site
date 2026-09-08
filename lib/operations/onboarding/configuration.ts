import { z } from "zod";
import { parseInviteKey } from "./invite-crypto";
import { onboardingEnabled } from "./worker-db";
export function readOnboardingConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  if (!onboardingEnabled(env)) return { enabled: false as const };
  const portal = new URL(z.url().parse(env.OPERATIONS_PORTAL_ORIGIN));
  if (
    portal.protocol !== "https:" ||
    portal.username ||
    portal.password ||
    portal.pathname !== "/" ||
    portal.search ||
    portal.hash
  )
    throw new Error("Onboarding portal origin is not configured.");
  return {
    enabled: true as const,
    portalOrigin: portal.origin,
    resendKey: z
      .string()
      .regex(/^re_[A-Za-z0-9_]+$/)
      .parse(env.OPERATIONS_RESEND_API_KEY),
    inviteKey: parseInviteKey(env.OPERATIONS_ONBOARDING_INVITE_KEY),
  };
}
