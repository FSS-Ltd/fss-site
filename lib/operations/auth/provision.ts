import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { readPortalAuthConfig } from "./configuration";
import {
  isPortalInvitationForEmail,
  readPortalInvitationId,
  isStaffInvitationForEmail,
  type PortalInvitationMetadata,
} from "./clerk-invitation";

export type PortalInvitation = {
  emailAddress: string;
  notify: true;
  ignoreExisting: true;
  expiresInDays: 30;
  redirectUrl: string;
  publicMetadata?: { fssPortalInvitation: PortalInvitationMetadata };
};
type CreateInvitation = (input: PortalInvitation) => Promise<void>;
type PendingInvitation = {
  readonly id: string;
  readonly emailAddress: string;
  readonly publicMetadata: unknown;
};
type PendingInvitationQuery = {
  readonly query: string;
  readonly status: "pending";
  readonly limit: number;
  readonly offset: number;
};
type ClerkInvitationClient = {
  invitations: {
    getInvitationList: (
      query: PendingInvitationQuery,
    ) => Promise<{ data: readonly PendingInvitation[] }>;
    revokeInvitation: (invitationId: string) => Promise<unknown>;
  };
};
type ClerkInvitationClientFactory = () => Promise<ClerkInvitationClient>;

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

export async function revokePendingClerkStaffInvitations(
  email: string,
  claimedInvitationIds: readonly string[],
  clientFactory: ClerkInvitationClientFactory = clerkClient,
): Promise<void> {
  await reconcilePendingInvitations(
    email,
    claimedInvitationIds,
    isStaffInvitationForEmail,
    clientFactory,
  );
}

export async function revokePendingClerkPortalInvitations(
  email: string,
  claimedInvitationIds: readonly string[],
  clientFactory: ClerkInvitationClientFactory = clerkClient,
): Promise<void> {
  await reconcilePendingInvitations(
    email,
    claimedInvitationIds,
    isPortalInvitationForEmail,
    clientFactory,
  );
}

export async function revokePendingClerkInvitationById(
  email: string,
  invitationId: string,
  realm: "portal" | "staff",
  clientFactory: ClerkInvitationClientFactory = clerkClient,
): Promise<void> {
  await reconcilePendingInvitations(
    email,
    [z.uuid().parse(invitationId)],
    realm === "staff" ? isStaffInvitationForEmail : isPortalInvitationForEmail,
    clientFactory,
  );
}

async function reconcilePendingInvitations(
  email: string,
  claimedInvitationIds: readonly string[],
  matchesRealm: (metadata: unknown, email: string) => boolean,
  clientFactory: ClerkInvitationClientFactory,
): Promise<void> {
  const normalizedEmail = z
    .string()
    .trim()
    .email()
    .max(254)
    .parse(email)
    .toLowerCase();
  const claimedIds = new Set(claimedInvitationIds);
  const client = await clientFactory();
  const pendingIds = new Set<string>();
  const pageSize = 100;
  // Read all pages first: revoking while paginating shifts the remaining offsets.
  for (let offset = 0; ; offset += pageSize) {
    const { data } = await client.invitations.getInvitationList({
      query: normalizedEmail,
      status: "pending",
      limit: pageSize,
      offset,
    });
    for (const invitation of data) {
      if (
        invitation.emailAddress.trim().toLowerCase() === normalizedEmail &&
        matchesRealm(invitation.publicMetadata, normalizedEmail) &&
        claimedIds.has(readPortalInvitationId(invitation.publicMetadata) ?? "")
      )
        pendingIds.add(invitation.id);
    }
    if (data.length < pageSize) break;
  }
  for (const id of pendingIds) await client.invitations.revokeInvitation(id);
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
      notify: true,
      ignoreExisting: true,
      expiresInDays: 30,
      redirectUrl: parsedRedirectUrl,
      ...(metadata
        ? { publicMetadata: { fssPortalInvitation: metadata } }
        : {}),
    });
  } catch (error) {
    throw new PortalProvisioningError(classifyProvisioningError(error));
  }
}

function classifyProvisioningError(
  error: unknown,
): PortalProvisioningErrorCode {
  const status = readErrorStatus(error);

  if (status === 409) return "INVITATION_CONFLICT";
  if (status === 400 || status === 422) return "INVALID_PROVIDER_REQUEST";
  if (status === 401 || status === 403) return "PROVIDER_AUTHENTICATION_FAILED";
  if (
    status === 408 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  )
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
