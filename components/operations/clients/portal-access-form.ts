import { portalRoles, type PortalRole } from "@/lib/operations/auth/types";
import type { PortalAccessOperation } from "@/lib/operations/auth/operator";

export type InvitationType = "client" | "admin";

export function createInvitationPayload(
  form: FormData,
  type: InvitationType,
): Extract<
  PortalAccessOperation,
  { action: "invite_client" | "invite_admin" }
> {
  const details = {
    name: readString(form, "name"),
    email: readString(form, "email"),
    reviewReference: readString(form, "reviewReference"),
  };
  if (type === "admin") return { action: "invite_admin", ...details };
  const role = readString(form, "role");
  if (!isPortalRole(role))
    throw new TypeError("Choose a supported client role.");
  return { action: "invite_client", ...details, role };
}

type GrantAccessPayload = {
  action: "grant_access";
  organisationId: string;
  name: string;
  email: string;
  role: PortalRole;
  reviewReference: string;
};

function readString(form: FormData, name: string): string {
  const value = form.get(name);

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${name} to be a form string.`);
  }

  return value;
}

function isPortalRole(value: string): value is PortalRole {
  return portalRoles.some((role) => role === value);
}

export function createGrantAccessPayload(form: FormData): GrantAccessPayload {
  const role = readString(form, "role");

  if (!isPortalRole(role)) {
    throw new TypeError("Expected role to be a supported portal role.");
  }

  return {
    action: "grant_access",
    organisationId: readString(form, "organisationId"),
    name: readString(form, "name"),
    email: readString(form, "email"),
    role,
    reviewReference: readString(form, "reviewReference"),
  };
}
