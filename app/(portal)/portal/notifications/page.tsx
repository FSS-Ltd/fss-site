import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { withVerifiedPortalIdentity } from "@/lib/operations/db/portal-client";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { MarkNotificationsRead } from "@/components/portal/requests/mark-notifications-read";
import styles from "@/components/portal/auth/portal.module.css";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  requestId: string;
  requestVersion: number;
  createdAt: string;
  readAt: string | null;
};

const kindLabels: Record<string, string> = {
  request_received: "New request",
  status_changed: "Request updated",
  public_comment: "New comment",
  review_requested: "Review requested",
  accepted: "Work accepted",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let notifications: NotificationRow[];
  try {
    const db = getPortalDb();
    notifications = await withVerifiedPortalIdentity(
      db,
      context.identity,
      randomUUID(),
      (tx) =>
        tx<NotificationRow[]>`
          select n.id, n.kind, n.title, n.body, n.request_id as "requestId",
            n.request_version as "requestVersion", n.created_at::text as "createdAt",
            n.read_at::text as "readAt"
          from operations.request_notifications n
          where n.user_id = ${context.identity.userId}
          order by n.created_at desc, n.id desc
          limit 100
        `,
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  const unread = notifications.filter((row) => row.readAt === null).length;
  return (
    <section aria-labelledby="notifications-heading">
      <p className={styles.eyebrow}>Client portal</p>
      <h1 id="notifications-heading" className={styles.heading}>
        Notifications
      </h1>
      <p className={styles.copy}>
        {unread === 0
          ? "You are up to date."
          : `${unread} unread notification${unread === 1 ? "" : "s"}.`}
      </p>
      {notifications.length > 0 && (
        <MarkNotificationsRead
          organisationId={context.organisationId}
          ids={notifications
            .filter((row) => row.readAt === null)
            .map((row) => row.id)}
        />
      )}
      {notifications.length === 0 ? (
        <p className={styles.actions}>
          Notifications appear here when your requests change.
        </p>
      ) : (
        <ul className={styles.list}>
          {notifications.map((row) => (
            <li
              className={styles.row}
              key={row.id}
              style={row.readAt ? { opacity: 0.7 } : undefined}
            >
              <p className={styles.eyebrow}>
                {kindLabels[row.kind] ?? "Update"}
                {row.readAt ? " · read" : ""}
              </p>
              <h2 className={styles.name}>{row.title}</h2>
              {row.body && <p className={styles.copy}>{row.body}</p>}
              <p className={styles.actions}>
                <Link
                  className={styles.link}
                  href={`${portalPath(`/portal/requests/${encodeURIComponent(row.requestId)}`)}?organisationId=${context.organisationId}`}
                >
                  Open request
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
