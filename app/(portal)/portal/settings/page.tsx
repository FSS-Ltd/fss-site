import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { NotificationPreferences } from "@/components/portal/workspace/notification-preferences";
import styles from "@/components/portal/projects.module.css";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { readPortalNotificationPreferences } from "@/lib/operations/workspaces/portal-repository";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  const preferences = await readPortalNotificationPreferences(
    getPortalDb(),
    context.identity,
    context.organisationId,
    randomUUID(),
  ).catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!preferences) return <PortalUnavailable />;
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Workspace settings</p>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.copy}>
        Choose how the organisation owner receives request email alerts.
      </p>
      <section
        className={styles.section}
        aria-labelledby="notification-settings-heading"
      >
        <div className={styles.sectionHeading}>
          <h2 id="notification-settings-heading">Notifications</h2>
          <span className={styles.note}>Owner setting</span>
        </div>
        <NotificationPreferences
          initialRequestEmailEnabled={preferences.requestEmailEnabled}
          organisationId={context.organisationId}
        />
      </section>
    </div>
  );
}
