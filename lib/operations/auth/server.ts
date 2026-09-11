import { auth, currentUser } from "@clerk/nextjs/server";
import type { VerifiedPortalIdentity } from "./types";
import { readVerifiedPortalUser } from "./verified-user";
export async function getPortalIdentity(): Promise<VerifiedPortalIdentity | null> {
  const session = await auth();
  if (!session.userId) return null;
  const user = await currentUser();
  if (!user || user.id !== session.userId)
    throw new Error("Portal authentication is unavailable.");
  return readVerifiedPortalUser(user);
}
