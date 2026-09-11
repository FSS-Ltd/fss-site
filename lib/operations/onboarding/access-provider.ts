import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { createPortalInviteToken } from "../auth/invites";
import { provisionPortalAccount } from "../auth/provision";
import { decryptInviteToken, encryptInviteToken } from "./invite-crypto";
import type { ApprovedEmail, EffectResult, OnboardingLease } from "./types";
export async function requireCurrentEffect(
  db: OperationsDb,
  lease: OnboardingLease,
): Promise<void> {
  const [row] = await db<
    { allowed: boolean }[]
  >`select operations.onboarding_can_execute(${lease.jobId},${lease.leaseToken},${lease.generation}) as allowed`;
  if (!row.allowed)
    throw new Error("Onboarding execution is no longer authorized.");
}
export function createOnboardingAccessProvider(
  db: OperationsDb,
  key: Buffer,
  portalOrigin: string,
  provision = provisionPortalAccount,
): (lease: OnboardingLease) => Promise<EffectResult> {
  return async (lease) => {
    if (
      !lease.proposal ||
      new URL(lease.proposal.portalUrl).origin !== portalOrigin
    )
      return {
        status: "failed",
        code: "configuration",
        retryable: false,
        uncertain: false,
      };
    const token = createPortalInviteToken();
    const encrypted = encryptInviteToken(
      token.token,
      key,
      lease.jobId,
      lease.recipient,
    );
    const [row] = await db<
      { receipt: unknown }[]
    >`select operations.onboarding_access(${lease.jobId},${lease.leaseToken},${lease.generation},${token.tokenHash},${JSON.stringify(encrypted)}::text::jsonb) as receipt`;
    const receipt = z
      .object({ providerId: z.string().min(1), acceptedAt: z.string().min(1) })
      .parse(row.receipt);
    await requireCurrentEffect(db, lease);
    await provision(lease.recipient, new URL("/portal/activate", portalOrigin).href);
    return {
      status: "succeeded",
      receipt: {
        ...receipt,
        acceptedAt: new Date(receipt.acceptedAt).toISOString(),
        url: new URL("/portal", portalOrigin).href,
      },
    };
  };
}
export async function resolveOnboardingAccess(
  db: OperationsDb,
  lease: OnboardingLease,
  email: ApprovedEmail,
  key: Buffer,
  portalOrigin: string,
): Promise<ApprovedEmail> {
  if (
    !email.text.includes("{{portal_access_url}}") ||
    !email.html.includes("{{portal_access_url}}")
  )
    throw new Error("Approved activation marker is missing.");
  const [row] = await db<
    { binding: unknown }[]
  >`select operations.onboarding_email_access(${lease.jobId},${lease.leaseToken},${lease.generation}) as binding`;
  const binding = z
    .object({ jobId: z.uuid(), recipient: z.email(), encrypted: z.unknown() })
    .parse(row.binding);
  if (binding.recipient !== lease.recipient || email.to !== lease.recipient)
    throw new Error("Approved recipient mismatch.");
  const url = new URL("/portal/activate", portalOrigin);
  if (binding.encrypted !== null)
    decryptInviteToken(binding.encrypted, key, binding.jobId, binding.recipient);
  // Generated URLs contain only a configured origin/path and a base64url token.
  const target = url.href;
  return {
    ...email,
    html: email.html.replaceAll("{{portal_access_url}}", target),
    text: email.text.replaceAll("{{portal_access_url}}", target),
  };
}
