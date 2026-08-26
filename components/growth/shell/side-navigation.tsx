import {
  GROWTH_NAVIGATION_ITEMS,
  getActiveGrowthNavigationItem,
} from "@/lib/growth/dashboard/navigation";

import { NavigationIcon } from "./navigation-icon";
import { GrowthNavigationLink } from "./navigation-link";
import styles from "./shell.module.css";

export function SideNavigation({ pathname }: { pathname: string }) {
  const activeItem = getActiveGrowthNavigationItem(pathname);

  return (
    <aside className={styles.sideRail}>
      <nav aria-label="Dashboard shortcuts" className={styles.sideNav}>
        {GROWTH_NAVIGATION_ITEMS.map((item) => (
          <GrowthNavigationLink
            aria-current={activeItem?.href === item.href ? "page" : undefined}
            aria-label={item.accessibleLabel}
            className={styles.sideNavLink}
            href={item.href}
            key={item.href}
          >
            <NavigationIcon name={item.icon} />
          </GrowthNavigationLink>
        ))}
      </nav>
    </aside>
  );
}
