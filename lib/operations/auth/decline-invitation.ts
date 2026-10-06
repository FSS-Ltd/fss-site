import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { hashDeclineToken } from "./decline-token";
import { revokePendingClerkInvitationById } from "./provision";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function declinePortalInvitation(
  db: OperationsDb,
  token: string,
  correlationId: string,
  revokeProvider: typeof revokePendingClerkInvitationById = revokePendingClerkInvitationById,
): Promise<boolean> {
  const parsedToken = tokenSchema.safeParse(token);
  if (!parsedToken.success) return false;
  const tokenHash = hashDeclineToken(parsedToken.data);
  const [invitation] = await db<
    { invitationId: string; invitationEmail: string }[]
  >`select invitation_id as "invitationId", invitation_email as "invitationEmail"
    from operations.decline_portal_invitation(${tokenHash}, ${z.uuid().parse(correlationId)})`;
  if (!invitation) return false;
  await revokeProvider(
    invitation.invitationEmail,
    invitation.invitationId,
    "portal",
  );
  await db`select operations.complete_portal_invitation_decline(${tokenHash})`;
  return true;
}
