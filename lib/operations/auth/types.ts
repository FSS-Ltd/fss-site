export const portalRoles = [
  "owner",
  "contributor",
  "billing_contact",
  "viewer",
] as const;
export type PortalRole = (typeof portalRoles)[number];

// Only the server authentication adapter may supply this verified identity.
export type VerifiedPortalIdentity = {
  readonly userId: string;
  readonly email: string;
  readonly emailVerified: true;
};

export type PortalContext = {
  readonly userId: string;
  readonly organisationId: string;
  readonly role: PortalRole;
  readonly correlationId: string;
};

export class PortalAccessDenied extends Error {
  constructor() {
    super("Portal access is unavailable.");
    this.name = "PortalAccessDenied";
  }
}
