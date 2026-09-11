import type { VerifiedPortalIdentity } from "./types";
import { readVerifiedPortalUser } from "./verified-user";

type ClerkWebhookEvent = { type: string; data: unknown };

export function readPortalIdentityFromClerkWebhook(
  event: ClerkWebhookEvent,
): VerifiedPortalIdentity | null {
  if (event.type !== "user.created" && event.type !== "user.updated") return null;
  return readVerifiedPortalUser(event.data);
}
