import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { MarkNotificationsRead } from "@/components/portal/requests/mark-notifications-read";
import { CollectionPagination } from "@/components/portal/workspace/collection-pagination";
import styles from "@/components/portal/auth/portal.module.css";
import workspace from "@/components/portal/workspace/workspace.module.css";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listPortalNotifications } from "@/lib/operations/workspaces/portal-repository";
import type { PortalNotificationFilter } from "@/lib/operations/workspaces/types";

export const dynamic = "force-dynamic";

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
  const params = await searchParams;
  const context = await getPortalPageContext(params.organisationId);
  if (!context) return <PortalUnavailable />;
  const data = await (async () => {
    const filter = z
      .enum(["all", "unread"])
      .parse(
        Array.isArray(params.filter) ? undefined : (params.filter ?? "all"),
      ) as PortalNotificationFilter;
    const page = parseWorkspacePage(params.page);
    const notifications = await listPortalNotifications(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
      filter,
      page,
    );
    const unread = notifications.items.filter(
      (row) => row.readAt === null,
    ).length;
    return { filter, notifications, unread };
  })().catch((error) => {
    if (error instanceof PortalAccessDenied) notFound();
    return null;
  });
  if (!data) return <PortalUnavailable />;
  const { filter, notifications, unread } = data;
  return (
    <section aria-labelledby="notifications-heading">
      <p className={styles.eyebrow}>Client portal</p>
      <h1 id="notifications-heading" className={styles.heading}>
        Notifications
      </h1>
      <p className={styles.copy}>
        {unread === 0
          ? "You are up to date on this page."
          : `${unread} unread notification${unread === 1 ? "" : "s"} on this page.`}
      </p>
      <form className={workspace.filterForm} method="get">
        <input
          name="organisationId"
          type="hidden"
          value={context.organisationId}
        />
        <label>
          Show
          <select defaultValue={filter} name="filter">
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
          </select>
        </label>
        <button type="submit">Apply filter</button>
      </form>
      {notifications.items.length > 0 && (
        <MarkNotificationsRead
          organisationId={context.organisationId}
          ids={notifications.items
            .filter((row) => row.readAt === null)
            .map((row) => row.id)}
        />
      )}
      {notifications.items.length === 0 ? (
        <p className={styles.actions}>
          {filter === "unread"
            ? "There are no unread notifications."
            : "Notifications appear here when your requests change."}
        </p>
      ) : (
        <ul className={styles.list}>
          {notifications.items.map((row) => (
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
      <CollectionPagination
        filter={{ filter: filter === "all" ? undefined : filter }}
        hasNext={notifications.hasNext}
        organisationId={context.organisationId}
        page={notifications.page}
        path="/portal/notifications"
      />
    </section>
  );
}
