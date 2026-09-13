import {
  readPortalInvitationClaim,
  type PortalInvitationClaim,
} from "./clerk-invitation";

type ClerkWebhookEvent = { type: string; data: unknown };

export function readPortalInvitationClaimFromClerkWebhook(
  event: ClerkWebhookEvent,
): PortalInvitationClaim | null {
  if (event.type !== "user.created" && event.type !== "user.updated")
    return null;
  return readPortalInvitationClaim(event.data);
}
