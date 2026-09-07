import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { withVerifiedPortalIdentity } from "../db/portal-client";
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
