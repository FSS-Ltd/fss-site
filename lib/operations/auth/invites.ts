import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
import type { PortalInvitationClaim } from "./clerk-invitation";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "./types";

export function createPortalInviteToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPortalInviteToken(token) };
}

export function hashPortalInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function claimPortalInvite(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  token: string,
  correlationId: string,
): Promise<{ organisationId: string }> {
  if (
    !z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .safeParse(token).success
  )
    throw new PortalAccessDenied();
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [result] = await tx<{ organisationId: string | null }[]>`
      select operations.claim_portal_invite(${hashPortalInviteToken(token)}) as "organisationId"
    `;
    if (!result?.organisationId) throw new PortalAccessDenied();
    return { organisationId: result.organisationId };
  });
}

export async function claimPortalInviteForVerifiedEmail(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<boolean> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [result] = await tx<{ organisationId: string | null }[]>`
      select operations.claim_portal_invite_for_verified_email() as "organisationId"
    `;
    return Boolean(result?.organisationId);
  });
}

export async function claimClerkPortalInvitation(
  db: OperationsDb,
  claim: PortalInvitationClaim | null,
  correlationId: string,
): Promise<boolean> {
  if (!claim) return false;
  if (claim.invitation.version === 2 && "invitationId" in claim.invitation) {
    const invitationId = claim.invitation.invitationId;
    return withVerifiedPortalIdentity(db, claim.identity, correlationId, async (tx) => {
      const [result] = await tx<{ destination: string | null }[]>`
        select operations.claim_pending_portal_invitation(${invitationId}) as destination
      `;
      return result?.destination === "portal";
    });
  }
  if (claim.invitation.version !== 1) return false;
  const invitation = claim.invitation;
  return withVerifiedPortalIdentity(
    db,
    claim.identity,
    correlationId,
    async (tx) => {
      const [result] = await tx<{ organisationId: string | null }[]>`
        select operations.claim_clerk_portal_invitation(
          ${invitation.organisationId},
          ${invitation.name},
          ${invitation.email},
          ${invitation.role},
          ${invitation.reviewReference},
          ${invitation.approvedBy}
        ) as "organisationId"
      `;
      return Boolean(result?.organisationId);
    },
  );
}

export async function hasActivePortalMembership(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  correlationId: string,
): Promise<boolean> {
  return withVerifiedPortalIdentity(db, identity, correlationId, async (tx) => {
    const [result] = await tx<{ active: boolean }[]>`
      select exists(
        select 1 from operations.memberships
        where user_id = nullif(current_setting('operations.user_id', true), '')::uuid
          and revoked_at is null
      ) as active
    `;
    return result?.active === true;
  });
}
