export type GrowthNavigationIcon =
  | "overview"
  | "prospects"
  | "outreach"
  | "pipeline"
  | "deals"
  | "clients"
  | "analytics"
  | "newsletter"
  | "settings";

export type GrowthNavigationItem = {
  label: string;
  accessibleLabel: string;
  href: `/growth${string}`;
  icon: GrowthNavigationIcon;
};

export const GROWTH_NAVIGATION_ITEMS = [
  {
    label: "Overview",
    accessibleLabel: "Open Overview",
    href: "/growth",
    icon: "overview",
  },
  {
    label: "Prospects",
    accessibleLabel: "Open Prospects",
    href: "/growth/prospects",
    icon: "prospects",
  },
  {
    label: "Outreach",
    accessibleLabel: "Open Outreach",
    href: "/growth/outreach",
    icon: "outreach",
  },
  {
    label: "Pipeline",
    accessibleLabel: "Open Pipeline",
    href: "/growth/pipeline",
    icon: "pipeline",
  },
  {
    label: "Deals",
    accessibleLabel: "Open Deals",
    href: "/growth/deals",
    icon: "deals",
  },
  {
    label: "Clients",
    accessibleLabel: "Open Clients",
    href: "/growth/clients",
    icon: "clients",
  },
  {
    label: "Analytics",
    accessibleLabel: "Open Analytics",
    href: "/growth/analytics",
    icon: "analytics",
  },
  {
    label: "Newsletter",
    accessibleLabel: "Open Newsletter",
    href: "/growth/newsletter",
    icon: "newsletter",
  },
  {
    label: "Settings",
    accessibleLabel: "Open Settings",
    href: "/growth/settings",
    icon: "settings",
  },
] as const satisfies readonly GrowthNavigationItem[];

export type GrowthNavigationItemDefinition =
  (typeof GROWTH_NAVIGATION_ITEMS)[number];

export function getActiveGrowthNavigationItem(
  pathname: string,
): GrowthNavigationItemDefinition | null {
  if (pathname === "/growth" || pathname === "/growth/") {
    return GROWTH_NAVIGATION_ITEMS[0];
  }

  return (
    GROWTH_NAVIGATION_ITEMS.slice(1).find(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
    ) ?? null
  );
}
