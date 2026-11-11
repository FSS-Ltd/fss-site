import {
  hasPortalCapability,
  type PortalCapability,
} from "@/lib/operations/auth/permissions";
import type { PortalRole } from "@/lib/operations/auth/types";

export type PortalNavigationItem = Readonly<{
  id: string;
  label: string;
  href: string | null;
  active: boolean;
  unavailableReason?: string;
}>;

type ClientNavigationDefinition = Readonly<{
  id: string;
  label: string;
  href: string;
  capability?: PortalCapability;
}>;

const clientNavigation: readonly ClientNavigationDefinition[] = [
  { id: "home", label: "Home", href: "/portal" },
  {
    id: "getting-started",
    label: "Getting started",
    href: "/portal/getting-started",
    capability: "onboarding.read",
  },
  {
    id: "projects",
    label: "Projects",
    href: "/portal/projects",
    capability: "projects.read",
  },
  {
    id: "requests",
    label: "Requests",
    href: "/portal/requests",
    capability: "requests.comment",
  },
  {
    id: "documents",
    label: "Documents",
    href: "/portal/documents",
    capability: "documents.read",
  },
  {
    id: "agreements",
    label: "Agreements",
    href: "/portal/agreements",
    capability: "agreements.read",
  },
  {
    id: "billing",
    label: "Billing",
    href: "/portal/billing",
    capability: "billing.read",
  },
  {
    id: "services",
    label: "Services",
    href: "/portal/services",
    capability: "offers.read",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/portal/notifications",
    capability: "notifications.read",
  },
  { id: "help", label: "Help", href: "/portal/help" },
  {
    id: "settings",
    label: "Settings",
    href: "/portal/settings",
    capability: "settings.manage",
  },
];

const studioNavigation: readonly Omit<PortalNavigationItem, "active">[] = [
  { id: "overview", label: "Overview", href: "/portal/admin" },
  { id: "clients", label: "Clients", href: "/portal/admin/clients" },
  { id: "delivery", label: "Delivery", href: "/portal/admin/delivery" },
  { id: "agreements", label: "Agreements", href: "/portal/admin/agreements" },
  {
    id: "welcome",
    label: "Welcome journeys",
    href: "/portal/admin/welcome",
  },
  { id: "projects", label: "Projects", href: "/portal/admin/projects" },
  { id: "billing", label: "Billing", href: "/portal/admin/billing" },
  {
    id: "portal-access",
    label: "Portal access",
    href: "/portal/admin/portal-access",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/portal/admin/notifications",
  },
  { id: "settings", label: "Settings", href: "/portal/admin/settings" },
];

function normalisePortalPath(pathname: string): string {
  if (pathname === "/") return "/portal";
  return pathname.startsWith("/portal") ? pathname : `/portal${pathname}`;
}

function isActivePath(pathname: string, href: string): boolean {
  const normalisedPathname = normalisePortalPath(pathname);
  if (href === "/portal" || href === "/portal/admin")
    return normalisedPathname === href;
  return normalisedPathname === href || normalisedPathname.startsWith(`${href}/`);
}

export function getClientNavigation(
  role: PortalRole | null,
  pathname: string,
): PortalNavigationItem[] {
  return clientNavigation
    .filter(
      (item) =>
        !item.capability ||
        (role !== null && hasPortalCapability(role, item.capability)),
    )
    .map((item) => ({
      ...item,
      active: isActivePath(pathname, item.href),
    }));
}

export function getStudioNavigation(pathname: string): PortalNavigationItem[] {
  return studioNavigation.map((item) => ({
    ...item,
    active: item.href ? isActivePath(pathname, item.href) : false,
  }));
}

export const clientMobileNavigationIds = ["home", "projects", "requests"] as const;
export const studioMobileNavigationIds = ["overview", "clients", "delivery"] as const;
