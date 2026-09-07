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
  | "invites.request";

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
    "invites.request",
  ],
  contributor: [
    "projects.read",
    "documents.read",
    "requests.create",
    "requests.comment",
    "assets.write",
  ],
  billing_contact: ["billing.read", "billing.manage"],
  viewer: ["projects.read", "documents.read"],
};

export function hasPortalCapability(
  role: PortalRole,
  capability: PortalCapability,
): boolean {
  return permissions[role]?.includes(capability) ?? false;
}
