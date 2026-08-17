import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import {
  GROWTH_NAVIGATION_ITEMS,
  getActiveGrowthNavigationItem,
} from "@/lib/growth/dashboard/navigation";

import { signOutFounder } from "./actions";
import { IntegrationStatusMenu } from "./integration-status-menu";
import styles from "./shell.module.css";
import type { ShellNavigationProps } from "./types";

export function TopNavigation({
  founder,
  integrations,
  pathname,
}: ShellNavigationProps) {
  const activeItem = getActiveGrowthNavigationItem(pathname);

  return (
    <header className={styles.topBar}>
      <Link className={styles.brand} href="/growth">
        <Image
          alt=""
          className={styles.brandMark}
          height={57}
          priority
          src="/redesign/brand/fss-monogram-navy-small.png"
          width={128}
        />
        <span>FSS Growth OS</span>
      </Link>

      <nav aria-label="Primary dashboard" className={styles.topNav}>
        {GROWTH_NAVIGATION_ITEMS.map((item) => (
          <Link
            aria-current={activeItem?.href === item.href ? "page" : undefined}
            className={styles.topNavLink}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.accountArea}>
        <IntegrationStatusMenu integrations={integrations} />
        <span className={styles.accountIdentity}>{founder.email}</span>
        <span aria-hidden="true" className={styles.avatar}>
          JN
        </span>
        <form action={signOutFounder} className={styles.desktopSignOut}>
          <button
            aria-label="Sign out"
            className={styles.iconButton}
            type="submit"
          >
            <LogOut aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
