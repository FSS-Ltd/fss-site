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

export type PortalProvisioningErrorCode =
  | "INVITATION_CONFLICT"
  | "INVALID_PROVIDER_REQUEST"
  | "PROVIDER_AUTHENTICATION_FAILED"
  | "RETRYABLE_PROVIDER_ERROR"
  | "UNKNOWN_PROVIDER_ERROR";

export class PortalProvisioningError extends Error {
  readonly code: PortalProvisioningErrorCode;

  constructor(code: PortalProvisioningErrorCode) {
    super("Portal provisioning is unavailable.");
    this.name = "PortalProvisioningError";
    this.code = code;
  }
}

export type PortalProvisioningErrorReport = {
  errorName: "PortalProvisioningError" | "UnknownError";
  errorCode?: PortalProvisioningErrorCode;
};

export function toPortalProvisioningErrorReport(
  error: unknown,
): PortalProvisioningErrorReport {
  return error instanceof PortalProvisioningError
    ? { errorName: "PortalProvisioningError", errorCode: error.code }
    : { errorName: "UnknownError" };
}

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
  } catch (error) {
    throw new PortalProvisioningError(classifyProvisioningError(error));
  }
}

function classifyProvisioningError(error: unknown): PortalProvisioningErrorCode {
  const status = readErrorStatus(error);

  if (status === 409) return "INVITATION_CONFLICT";
  if (status === 400 || status === 422) return "INVALID_PROVIDER_REQUEST";
  if (status === 401 || status === 403) return "PROVIDER_AUTHENTICATION_FAILED";
  if (status === 408 || status === 429 || (status !== undefined && status >= 500))
    return "RETRYABLE_PROVIDER_ERROR";
  return "UNKNOWN_PROVIDER_ERROR";
}

function readErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  try {
    const value = Reflect.get(error, "status");
    return typeof value === "number" && Number.isInteger(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
