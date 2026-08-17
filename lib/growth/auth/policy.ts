export type FounderProfile = {
  email?: string | null;
  emailVerified?: boolean;
};

export function isAllowedFounderProfile(
  profile: FounderProfile,
  ownerEmail: string,
): boolean {
  const normalisedOwnerEmail = ownerEmail.trim().toLowerCase();

  if (
    profile.emailVerified !== true ||
    typeof profile.email !== "string" ||
    normalisedOwnerEmail.length === 0
  ) {
    return false;
  }

  return profile.email.trim().toLowerCase() === normalisedOwnerEmail;
}
