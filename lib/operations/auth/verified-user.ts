import { createHash } from "node:crypto";
import { z } from "zod";
import type { VerifiedPortalIdentity } from "./types";
const verifiedUser = z.strictObject({
  id: z.string().regex(/^user_[A-Za-z0-9]+$/),
  primary_email_address_id: z.string().nullable(),
  email_addresses: z.array(
    z.strictObject({
      id: z.string().min(1),
      email_address: z.email().transform((email) => email.toLowerCase()),
      verification: z
        .strictObject({ status: z.literal("verified") })
        .nullable(),
    }),
  ),
});
export function portalUserIdFromClerkId(clerkUserId: string): string {
  const bytes = createHash("sha256").update(`clerk:${clerkUserId}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function readVerifiedClerkEmail(user: unknown): string | null {
  const parsed = verifiedUser.safeParse(user);
  if (!parsed.success || !parsed.data.primary_email_address_id) return null;
  const address = parsed.data.email_addresses.find(
    ({ id }) => id === parsed.data.primary_email_address_id,
  );
  return address?.verification?.status === "verified"
    ? address.email_address
    : null;
}
export function readVerifiedPortalUser(
  user: unknown,
): VerifiedPortalIdentity | null {
  const parsed = verifiedUser.safeParse(user);
  const email = readVerifiedClerkEmail(user);
  if (!parsed.success || !email) return null;
  return {
    userId: portalUserIdFromClerkId(parsed.data.id),
    email,
    emailVerified: true,
  };
}
