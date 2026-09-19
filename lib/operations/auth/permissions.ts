import type { PortalRole } from "./types";

export type PortalCapability =
  | "projects.read"
  | "documents.read"
  | "requests.create"
  | "requests.comment"
  | "requests.review"
  | "assets.write"
  | "billing.read"
  | "billing.manage"
  | "agreements.read"
  | "agreements.accept"
  | "onboarding.read"
  | "invites.request"
  | "offers.read"
  | "offers.enquire";

const permissions: Record<PortalRole, readonly PortalCapability[]> = {
  owner: [
    "projects.read",
    "documents.read",
    "requests.create",
    "requests.comment",
    "requests.review",
    "assets.write",
    "billing.read",
    "billing.manage",
    "agreements.read",
    "onboarding.read",
    "invites.request",
    "offers.read",
    "offers.enquire",
  ],
  contributor: [
    "projects.read",
    "documents.read",
    "requests.create",
    "requests.comment",
    "assets.write",
    "onboarding.read",
    "offers.read",
    "offers.enquire",
  ],
  billing_contact: ["billing.read", "billing.manage", "offers.read"],
  viewer: ["projects.read", "documents.read", "onboarding.read", "offers.read"],
};

export type PortalRolePresentation = { label: string; detail: string };

export const portalRolePresentation: Record<
  PortalRole,
  PortalRolePresentation
> = {
  owner: {
    label: "Owner",
    detail:
      "Projects, requests, agreements, billing, and invitation requests for the organisation.",
  },
  contributor: {
    label: "Contributor",
    detail:
      "Projects, shared documents, and creating or commenting on requests.",
  },
  billing_contact: {
    label: "Billing contact",
    detail: "Billing records and payment management only.",
  },
  viewer: {
    label: "Viewer",
    detail: "Read-only projects, documents, and services.",
  },
};

export function getPortalRolePresentation(
  role: PortalRole,
): PortalRolePresentation {
  return portalRolePresentation[role];
}

export function hasPortalCapability(
  role: PortalRole,
  capability: PortalCapability,
): boolean {
  return permissions[role]?.includes(capability) ?? false;
}
