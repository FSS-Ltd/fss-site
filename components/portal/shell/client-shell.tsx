"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import type { PortalMembershipSummary } from "@/lib/operations/auth/require-member";
import {
  clientMobileNavigationIds,
  getClientNavigation,
  type PortalNavigationItem,
} from "./navigation";
import styles from "./portal-shell.module.css";

export type ClientShellProps = Readonly<{
  memberships: readonly PortalMembershipSummary[];
  children: React.ReactNode;
}>;

function appendOrganisationId(
  href: string,
  organisationId: string | undefined,
): string {
  const portalHref = portalPath(href);
  if (!organisationId) return portalHref;
  const separator = portalHref.includes("?") ? "&" : "?";
  return `${portalHref}${separator}organisationId=${encodeURIComponent(organisationId)}`;
}

function NavigationLink({
  item,
  organisationId,
}: Readonly<{
  item: PortalNavigationItem;
  organisationId?: string;
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
      href={appendOrganisationId(item.href, organisationId)}
    >
      <span className={styles.navigationIcon} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function ClientMobileNavigation({
  items,
  organisationId,
}: Readonly<{
  items: readonly PortalNavigationItem[];
  organisationId?: string;
}>): React.JSX.Element {
  const primaryItems = items.filter((item) =>
    clientMobileNavigationIds.includes(
      item.id as (typeof clientMobileNavigationIds)[number],
    ),
  );
  const moreItems = items.filter((item) => !primaryItems.includes(item));

  return (
    <nav className={styles.mobileNavigation} aria-label="Client navigation">
      <div className={styles.mobileNavigationLinks}>
        {primaryItems.map((item) => (
          <NavigationLink
            item={item}
            key={item.id}
            organisationId={organisationId}
          />
        ))}
      </div>
      {moreItems.length > 0 ? (
        <details className={styles.mobileMore}>
          <summary className={styles.mobileMoreSummary}>More</summary>
          <div className={styles.mobileMorePanel}>
            <nav aria-label="More client navigation">
              <div className={styles.mobileMoreList}>
                {moreItems.map((item) => (
                  <NavigationLink
                    item={item}
                    key={item.id}
                    organisationId={organisationId}
                  />
                ))}
              </div>
            </nav>
          </div>
        </details>
      ) : null}
    </nav>
  );
}

export function ClientShell({
  children,
  memberships,
}: ClientShellProps): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedOrganisationId = searchParams.get("organisationId");
  const activeMembership =
    memberships.find(
      (membership) => membership.organisationId === requestedOrganisationId,
    ) ?? memberships[0];
  const navigation = getClientNavigation(activeMembership?.role ?? null, pathname);
  const returnTo = encodeURIComponent(portalPath("/portal/login"));

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#portal-content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Client workspace">
        <Link className={styles.brand} href={portalPath("/portal")}>
          <Image
            alt="FSS"
            className={styles.brandImage}
            height={57}
            priority
            src="/redesign/brand/fss-monogram-navy-small.png"
            width={128}
          />
        </Link>
        <section className={styles.workspace} aria-labelledby="workspace-title">
          <p className={styles.sidebarLabel} id="workspace-title">
            Your Studio workspace
          </p>
          <details className={styles.workspaceChooser}>
            <summary>
              {activeMembership?.displayName ?? "Choose your workspace"}
            </summary>
            <div className={styles.workspacePanel}>
              {memberships.length > 0 ? (
                <ul className={styles.workspaceList}>
                  {memberships.map((membership) => (
                    <li key={membership.organisationId}>
                      <Link
                        aria-current={
                          membership.organisationId === activeMembership?.organisationId
                            ? "true"
                            : undefined
                        }
                        href={appendOrganisationId("/portal", membership.organisationId)}
                      >
                        <span>{membership.displayName}</span>
                        <small>{getPortalRolePresentation(membership.role).label}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.workspaceEmpty}>
                  Your access is being prepared.
                </p>
              )}
            </div>
          </details>
        </section>
        <nav className={styles.navigation} aria-label="Client modules">
          {navigation.map((item) => (
            <NavigationLink
              item={item}
              key={item.id}
              organisationId={activeMembership?.organisationId}
            />
          ))}
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <p className={styles.context}>
            {activeMembership?.displayName ?? "Your FSS workspace"}
          </p>
          <form action={`/api/auth/sign-out?returnTo=${returnTo}`} method="post">
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </header>
        <main className={styles.main} id="portal-content">
          {children}
        </main>
      </div>
      <ClientMobileNavigation
        items={navigation}
        organisationId={activeMembership?.organisationId}
      />
    </div>
  );
}
