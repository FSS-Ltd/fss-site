import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type {
  PortalNotification,
  PortalNotificationFilter,
} from "@/lib/operations/workspaces/types";
import { MarkNotificationsRead } from "../requests/mark-notifications-read";
import styles from "../client-workspace.module.css";

type ClientNotificationInboxProps = Readonly<{
  filter: PortalNotificationFilter;
  notifications: readonly PortalNotification[];
  organisationId: string;
  pagination?: React.ReactNode;
}>;

const filterOptions: ReadonlyArray<{
  label: string;
  value: PortalNotificationFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Action needed", value: "action_needed" },
];

const kindLabels: Readonly<Record<string, string>> = {
  accepted: "Work accepted",
  public_comment: "New comment",
  request_received: "New request",
  review_requested: "Review requested",
  status_changed: "Request updated",
};

function organisationHref(
  pathname: string,
  organisationId: string,
  filter?: PortalNotificationFilter,
): string {
  const query = new URLSearchParams({ organisationId });
  if (filter && filter !== "all") query.set("filter", filter);
  return `${portalPath(pathname)}?${query.toString()}`;
}

function destinationHref(
  notification: PortalNotification,
  organisationId: string,
): string {
  return organisationHref(
    `/portal/requests/${notification.requestId}`,
    organisationId,
  );
}

export function ClientNotificationInbox({
  filter,
  notifications,
  organisationId,
  pagination,
}: ClientNotificationInboxProps): React.JSX.Element {
  const unreadIds = notifications
    .filter((notification) => notification.readAt === null)
    .map((notification) => notification.id);

  return (
    <div className={styles.page}>
      <PageHeader
        breadcrumbs={[{ href: portalPath("/portal"), label: "Your workspace" }]}
        description="Important decisions and progress, without the noise."
        eyebrow="Workspace notifications"
        title="Your updates"
      />
      <nav aria-label="Notification filters">
        {filterOptions.map((option) => (
          <PortalActionLink
            aria-current={filter === option.value ? "page" : undefined}
            href={organisationHref(
              "/portal/notifications",
              organisationId,
              option.value,
            )}
            key={option.value}
            variant={filter === option.value ? "primary" : "secondary"}
          >
            {option.label}
          </PortalActionLink>
        ))}
      </nav>
      {unreadIds.length > 0 ? (
        <MarkNotificationsRead
          organisationId={organisationId}
          ids={unreadIds}
        />
      ) : null}
      {notifications.length === 0 ? (
        <Notice tone="info">
          {filter === "action_needed"
            ? "There are no decisions waiting for you right now."
            : filter === "unread"
              ? "There are no unread notifications."
              : "Notifications appear here when your requests change."}
        </Notice>
      ) : (
        <ul className={styles.cardList} aria-label="Workspace notifications">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <PortalCard className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>{notification.title}</h2>
                  <StatusBadge
                    status={notification.readAt ? "neutral" : "info"}
                  >
                    {notification.readAt
                      ? "Read"
                      : (kindLabels[notification.kind] ?? "Update")}
                  </StatusBadge>
                </div>
                <p className={styles.summary}>{notification.body}</p>
                <PortalActionLink
                  href={destinationHref(notification, organisationId)}
                  variant="secondary"
                >
                  {notification.kind === "review_requested"
                    ? "Review now"
                    : "Open request"}
                </PortalActionLink>
              </PortalCard>
            </li>
          ))}
        </ul>
      )}
      {pagination}
    </div>
  );
}
