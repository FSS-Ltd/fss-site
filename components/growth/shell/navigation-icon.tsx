import {
  BadgePoundSterling,
  Briefcase,
  ChartLine,
  Kanban,
  LayoutDashboard,
  Mail,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { GrowthNavigationIcon } from "@/lib/growth/dashboard/navigation";

const icons: Record<GrowthNavigationIcon, LucideIcon> = {
  overview: LayoutDashboard,
  prospects: Users,
  outreach: Mail,
  pipeline: Kanban,
  deals: BadgePoundSterling,
  clients: Briefcase,
  analytics: ChartLine,
  newsletter: Newspaper,
  settings: Settings,
};

export function NavigationIcon({ name }: { name: GrowthNavigationIcon }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" size={20} strokeWidth={1.8} />;
}
