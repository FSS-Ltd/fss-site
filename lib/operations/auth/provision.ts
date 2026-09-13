import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { readPortalAuthConfig } from "./configuration";
import type { PortalInvitationMetadata } from "./clerk-invitation";

export type PortalInvitation = {
  emailAddress: string;
  redirectUrl: string;
  publicMetadata?: { fssPortalInvitation: PortalInvitationMetadata };
};
type CreateInvitation = (input: PortalInvitation) => Promise<void>;

export function readPortalProvisionConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { secretKey: string } {
  return { secretKey: readPortalAuthConfig(env).secretKey };
}

async function createInvitation(input: PortalInvitation): Promise<void> {
  await (await clerkClient()).invitations.createInvitation(input);
}

export async function clearPortalInvitationMetadata(
  clerkUserId: string,
): Promise<void> {
  await (
    await clerkClient()
  ).users.updateUserMetadata(clerkUserId, {
    publicMetadata: { fssPortalInvitation: null },
  });
}

export async function provisionPortalAccount(
  email: string,
  redirectUrl: string,
  metadata: PortalInvitationMetadata | undefined,
  create: CreateInvitation = createInvitation,
): Promise<void> {
  const normalizedEmail = z.email().max(254).parse(email).toLowerCase();
  const parsedRedirectUrl = z.url().parse(redirectUrl);
  try {
    await create({
      emailAddress: normalizedEmail,
      redirectUrl: parsedRedirectUrl,
      ...(metadata
        ? { publicMetadata: { fssPortalInvitation: metadata } }
        : {}),
    });
  } catch {
    throw new Error("Portal provisioning is unavailable.");
  }
}
