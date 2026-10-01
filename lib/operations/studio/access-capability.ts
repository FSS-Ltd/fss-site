import type { FssAdminContext } from "../auth/staff-types";
import type { VerifiedPortalIdentity } from "../auth/types";

// admin must come from requireFssAdmin; every read/mutation rechecks its active grant.
export function hasStudioFounderCapability(
  admin: FssAdminContext,
  identity: VerifiedPortalIdentity | null | undefined,
  ownerEmail: string | undefined = process.env.GROWTH_OS_OWNER_EMAIL,
): boolean {
  return Boolean(
    admin.realm === "staff" &&
    admin.role === "admin" &&
    identity?.emailVerified === true &&
    identity.userId === admin.userId &&
    ownerEmail?.trim() &&
    identity.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase(),
  );
}
