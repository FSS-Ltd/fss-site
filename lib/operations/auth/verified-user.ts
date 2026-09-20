import { createHash } from "node:crypto";
import { z } from "zod";
import type { VerifiedPortalIdentity } from "./types";

const verifiedUser = z
  .object({
    id: z.string().regex(/^user_[A-Za-z0-9]+$/),
    primary_email_address_id: z.string().nullable().optional(),
    primaryEmailAddressId: z.string().nullable().optional(),
    email_addresses: z
      .array(
        z.object({
          id: z.string().min(1),
          email_address: z
            .email()
            .transform((email) => email.toLowerCase())
            .optional(),
          emailAddress: z
            .email()
            .transform((email) => email.toLowerCase())
            .optional(),
          verification: z.object({ status: z.literal("verified") }).nullable(),
        }),
      )
      .optional(),
    emailAddresses: z
      .array(
        z.object({
          id: z.string().min(1),
          email_address: z
            .email()
            .transform((email) => email.toLowerCase())
            .optional(),
          emailAddress: z
            .email()
            .transform((email) => email.toLowerCase())
            .optional(),
          verification: z.object({ status: z.literal("verified") }).nullable(),
        }),
      )
      .optional(),
  })
  .passthrough();

type ClerkEmailAddress = {
  id: string;
  email_address?: string;
  emailAddress?: string;
  verification: { status: "verified" } | null;
};
export function portalUserIdFromClerkId(clerkUserId: string): string {
  const bytes = createHash("sha256").update(`clerk:${clerkUserId}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function readVerifiedClerkEmail(user: unknown): string | null {
  const parsed = verifiedUser.safeParse(user);
  const primaryEmailAddressId = parsed.success
    ? (parsed.data.primaryEmailAddressId ??
      parsed.data.primary_email_address_id)
    : null;
  const emailAddresses: readonly ClerkEmailAddress[] = parsed.success
    ? (parsed.data.emailAddresses ?? parsed.data.email_addresses ?? [])
    : [];
  if (!parsed.success || !primaryEmailAddressId) return null;
  const address = emailAddresses.find(({ id }) => id === primaryEmailAddressId);
  if (address?.verification?.status !== "verified") return null;
  return address.emailAddress ?? address.email_address ?? null;
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

export function readClerkDisplayName(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const firstName = Reflect.get(user, "first_name") ?? Reflect.get(user, "firstName");
  const lastName = Reflect.get(user, "last_name") ?? Reflect.get(user, "lastName");
  const name = [firstName, lastName]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();
  return name.length > 0 && name.length <= 200 ? name : null;
}
