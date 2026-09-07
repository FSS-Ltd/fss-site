import { z } from "zod";
import type { VerifiedPortalIdentity } from "./types";
const verifiedUser = z.object({
  id: z.uuid(),
  email: z.email().transform((email) => email.toLowerCase()),
  email_confirmed_at: z.iso.datetime(),
  is_anonymous: z.literal(false),
});
type UserLookup = () => Promise<{ data: { user: unknown }; error: unknown }>;
export async function readVerifiedPortalUser(
  lookup: UserLookup,
): Promise<VerifiedPortalIdentity | null> {
  const { data, error } = await lookup();
  if (error) {
    if (
      typeof error === "object" &&
      (("status" in error &&
        (error.status === 400 ||
          error.status === 401 ||
          error.status === 403)) ||
        ("name" in error && error.name === "AuthSessionMissingError"))
    )
      return null;
    throw new Error("Portal authentication is unavailable.");
  }
  const parsed = verifiedUser.safeParse(data.user);
  return parsed.success
    ? { userId: parsed.data.id, email: parsed.data.email, emailVerified: true }
    : null;
}
