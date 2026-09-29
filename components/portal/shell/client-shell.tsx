"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import type { PortalMembershipSummary } from "@/lib/operations/auth/require-member";
import { PortalSignOutButton } from "../auth/portal-sign-out";
import {
  clientMobileNavigationIds,
  getClientNavigation,
  type PortalNavigationItem,
} from "./navigation";
import { PortalNavigationIcon } from "./navigation-icon";
import { PortalAppearanceControl } from "./appearance-control";
import type { PortalAppearance } from "@/lib/operations/design/portal-appearance";
import styles from "./portal-shell.module.css";

export type ClientShellProps = Readonly<{
  initialAppearance?: PortalAppearance;
  memberships: readonly PortalMembershipSummary[];
  prefixFreeEnabled?: boolean;
  children: React.ReactNode;
}>;

function appendOrganisationId(
  href: string,
  organisationId: string | undefined,
  prefixFreeEnabled: boolean,
): string {
  const portalHref = portalPath(href, prefixFreeEnabled);
  if (!organisationId) return portalHref;
  const separator = portalHref.includes("?") ? "&" : "?";
  return `${portalHref}${separator}organisationId=${encodeURIComponent(organisationId)}`;
}

function NavigationLink({
  item,
  organisationId,
  prefixFreeEnabled,
}: Readonly<{
  item: PortalNavigationItem;
  organisationId?: string;
  prefixFreeEnabled: boolean;
}>): React.JSX.Element {
  if (!item.href) {
    return (
      <span className={styles.navigationUnavailable} aria-disabled="true">
        <PortalNavigationIcon itemId={item.id} />
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
      href={appendOrganisationId(item.href, organisationId, prefixFreeEnabled)}
    >
      <PortalNavigationIcon itemId={item.id} />
      <span>{item.label}</span>
    </Link>
  );
}

function ClientMobileNavigation({
  items,
  organisationId,
  prefixFreeEnabled,
}: Readonly<{
  items: readonly PortalNavigationItem[];
  organisationId?: string;
  prefixFreeEnabled: boolean;
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
            prefixFreeEnabled={prefixFreeEnabled}
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
                    prefixFreeEnabled={prefixFreeEnabled}
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
  initialAppearance = "system",
  memberships,
  prefixFreeEnabled = true,
}: ClientShellProps): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedOrganisationId = searchParams.get("organisationId");
  const activeMembership =
    memberships.find(
      (membership) => membership.organisationId === requestedOrganisationId,
    ) ?? (memberships.length === 1 ? memberships[0] : undefined);
  const navigation = getClientNavigation(
    activeMembership?.role ?? null,
    pathname,
  );
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#portal-content">
        Skip to content
      </a>
      <aside className={styles.sidebar} aria-label="Client workspace">
        <Link
          className={styles.brand}
          href={portalPath("/portal", prefixFreeEnabled)}
        >
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
                          membership.organisationId ===
                          activeMembership?.organisationId
                            ? "true"
                            : undefined
                        }
                        href={appendOrganisationId(
                          "/portal",
                          membership.organisationId,
                          prefixFreeEnabled,
                        )}
                      >
                        <span>{membership.displayName}</span>
                        <small>
                          {getPortalRolePresentation(membership.role).label}
                        </small>
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
              prefixFreeEnabled={prefixFreeEnabled}
            />
          ))}
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <span className={styles.context}>Client workspace</span>
          <div className={styles.toolbarActions}>
            {navigation.some((item) => item.id === "notifications") ? (
              <Link
                className={styles.toolbarIcon}
                href={appendOrganisationId(
                  "/portal/notifications",
                  activeMembership?.organisationId,
                  prefixFreeEnabled,
                )}
                aria-label="Notifications"
              >
                <Bell aria-hidden="true" size={18} />
              </Link>
            ) : null}
            <PortalAppearanceControl initialAppearance={initialAppearance} />
            <PortalSignOutButton
              className={styles.signOut}
              redirectUrl={portalPath("/portal/login", prefixFreeEnabled)}
            >
              Sign out
            </PortalSignOutButton>
          </div>
        </header>
        {memberships.length > 1 ? (
          <details className={styles.mobileWorkspace}>
            <summary>
              {activeMembership?.displayName ?? "Choose your workspace"}
            </summary>
            <div className={styles.mobileWorkspaceList}>
              {memberships.map((membership) => (
                <Link
                  key={membership.organisationId}
                  href={appendOrganisationId(
                    "/portal",
                    membership.organisationId,
                    prefixFreeEnabled,
                  )}
                  aria-current={
                    membership.organisationId ===
                    activeMembership?.organisationId
                      ? "true"
                      : undefined
                  }
                >
                  {membership.displayName}
                </Link>
              ))}
            </div>
          </details>
        ) : null}
        <main className={styles.main} id="portal-content">
          {children}
        </main>
      </div>
      <ClientMobileNavigation
        items={navigation}
        organisationId={activeMembership?.organisationId}
        prefixFreeEnabled={prefixFreeEnabled}
      />
    </div>
  );
}
