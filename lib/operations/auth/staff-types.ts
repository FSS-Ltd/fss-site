export type FssStaffRole = "admin";

export type StaffMembership = {
  readonly membershipId: string;
  readonly userId: string;
  readonly role: FssStaffRole;
};

// Constructed only by requireFssAdmin after checking the current staff grant.
export type FssAdminContext = StaffMembership & {
  readonly realm: "staff";
  readonly correlationId: string;
};
