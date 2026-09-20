"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { PortalSignOutButton } from "../auth/portal-sign-out";
import {
  getStudioNavigation,
  studioMobileNavigationIds,
  type PortalNavigationItem,
} from "./navigation";
import styles from "./portal-shell.module.css";

function StudioNavigationLink({
  item,
}: Readonly<{
  item: PortalNavigationItem;
}>): React.JSX.Element {
  if (!item.href) {
    return (
      <span className={styles.navigationUnavailable} aria-disabled="true">
        <span className={styles.navigationIcon} aria-hidden="true" />
        <span className={styles.navigationUnavailableContent}>
          <span>{item.label}</span>
          {item.unavailableReason ? (
            <span className={styles.navigationUnavailableReason}>
              {item.unavailableReason}
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <Link
      aria-current={item.active ? "page" : undefined}
      className={`${styles.navigationLink} ${item.active ? styles.navigationCurrent : ""}`}
      href={portalPath(item.href)}
    >
      <span className={styles.navigationIcon} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function StudioMobileNavigation({
  items,
}: Readonly<{
  items: readonly PortalNavigationItem[];
}>): React.JSX.Element {
  const primaryItems = items.filter((item) =>
    studioMobileNavigationIds.includes(
      item.id as (typeof studioMobileNavigationIds)[number],
    ),
  );
  const moreItems = items.filter((item) => !primaryItems.includes(item));

  return (
    <nav className={styles.mobileNavigation} aria-label="FSS Studio navigation">
      <div className={styles.mobileNavigationLinks}>
        {primaryItems.map((item) => (
          <StudioNavigationLink item={item} key={item.id} />
        ))}
      </div>
      <details className={styles.mobileMore}>
        <summary className={styles.mobileMoreSummary}>More</summary>
        <div className={styles.mobileMorePanel}>
          <nav aria-label="More FSS Studio navigation">
            <div className={styles.mobileMoreList}>
              {moreItems.map((item) => (
                <StudioNavigationLink item={item} key={item.id} />
              ))}
            </div>
          </nav>
        </div>
      </details>
    </nav>
  );
}

export function StudioShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  const pathname = usePathname();
  const navigation = getStudioNavigation(pathname);
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#studio-content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="FSS Studio">
        <Link className={styles.brand} href={portalPath("/portal/admin")}>
          <Image
            alt="FSS"
            className={styles.brandImage}
            height={57}
            priority
            src="/redesign/brand/fss-monogram-navy-small.png"
            width={128}
          />
        </Link>
        <div className={styles.studioIdentity}>
          <p className={styles.sidebarLabel}>Studio operations</p>
          <p className={styles.studioIdentityName}>Founder workspace</p>
          <span>All clients</span>
        </div>
        <nav className={styles.navigation} aria-label="FSS Studio modules">
          {navigation.map((item) => (
            <StudioNavigationLink item={item} key={item.id} />
          ))}
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <p className={styles.context}>FSS Studio</p>
          <PortalSignOutButton className={styles.signOut}>
            Sign out
          </PortalSignOutButton>
        </header>
        <main className={styles.main} id="studio-content">
          {children}
        </main>
      </div>
      <StudioMobileNavigation items={navigation} />
    </div>
  );
}
