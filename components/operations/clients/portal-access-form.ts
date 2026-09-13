import { portalRoles, type PortalRole } from "@/lib/operations/auth/types";

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
