export type FssStaffRole = "admin";

export type StaffMembership = {
  readonly membershipId: string;
  readonly userId: string;
  readonly role: FssStaffRole;
};

// Constructed only by requireFssAdmin after checking the current staff grant.
export type FssAdminContext = StaffMembership & {
  readonly realm: "staff";
  // A stable, non-PII audit actor derived from the verified Clerk identity.
  readonly actorId: string;
  readonly correlationId: string;
};
