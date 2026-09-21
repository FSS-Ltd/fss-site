import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalSelect,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { StudioNotificationDelivery } from "@/lib/operations/studio/operations-queues";
import type { WorkspaceCollectionPage } from "@/lib/operations/workspaces/pagination";
import styles from "./operations-queues.module.css";

type NotificationFilter = "all" | "pending" | "retry" | "succeeded" | "held" | "needs_attention";

function statusTone(status: StudioNotificationDelivery["status"]): "info" | "success" | "error" {
  if (status === "succeeded") return "success";
  if (status === "held") return "error";
  return "info";
}

function date(value: string | null): string {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function notificationsHref(page: number, status: NotificationFilter): string {
  const search = new URLSearchParams({ page: String(page) });
  if (status !== "all") search.set("status", status);
  return portalPath(`/portal/admin/notifications?${search.toString()}`);
}

export function NotificationDelivery({
  data,
  selectedStatus,
}: Readonly<{
  data: WorkspaceCollectionPage<StudioNotificationDelivery>;
  selectedStatus: NotificationFilter;
}>): React.JSX.Element {
  return (
    <section className={styles.page} aria-labelledby="studio-notifications-heading">
      <PageHeader
        action={<PortalActionLink href={notificationsHref(1, "needs_attention")}>Open failed deliveries</PortalActionLink>}
        description="Each email delivery remains independent from its in-app event and request history."
        eyebrow="FSS Studio · Notifications"
        title="Notification delivery"
      />
      <Notice tone="info">
        An email failure does not roll back the work status or remove the in-app notification. Recovery is limited to the recorded delivery.
      </Notice>
      <PortalCard title="Delivery filter">
        <form className={styles.filters} method="get">
          <PortalSelect defaultValue={selectedStatus} label="Delivery status" name="status">
            <option value="all">All deliveries</option>
            <option value="retry">Retry scheduled</option>
            <option value="needs_attention">Needs attention</option>
            <option value="pending">Pending</option>
            <option value="succeeded">Delivered</option>
            <option value="held">Held</option>
          </PortalSelect>
          <PortalButton type="submit" variant="secondary">Apply filter</PortalButton>
        </form>
      </PortalCard>
      {data.items.length === 0 ? (
        <PortalCard title="No matching deliveries"><p className={styles.empty}>No delivery records match this server-scoped view.</p></PortalCard>
      ) : (
        <ul className={styles.list} aria-label="Notification delivery queue">
          {data.items.map((delivery) => (
            <li key={delivery.id}>
              <PortalCard>
                <div className={styles.row}>
                  <div className={styles.rowSummary}>
                    <h2>{delivery.requestTitle}</h2>
                    <p>{delivery.organisationName} · {delivery.kind.replaceAll("_", " ")}</p>
                    <StatusBadge status={statusTone(delivery.status)}>{delivery.status.replaceAll("_", " ")}</StatusBadge>
                  </div>
                  <dl className={styles.rowMeta}>
                    <div><dt>Recipient</dt><dd>{delivery.recipientLabel}</dd></div>
                    <div><dt>Attempts</dt><dd>{delivery.attempts}</dd></div>
                    <div><dt>Next retry</dt><dd>{date(delivery.nextAttemptAt)}</dd></div>
                  </dl>
                  <div className={styles.rowSummary}>
                    {delivery.lastError ? <p>{delivery.lastError.replaceAll("_", " ")}</p> : null}
                    <PortalActionLink href={portalPath(`/portal/admin/clients/${delivery.organisationId}/requests/${delivery.requestId}`)}>
                      Open request
                    </PortalActionLink>
                  </div>
                </div>
              </PortalCard>
            </li>
          ))}
        </ul>
      )}
      {(data.page > 1 || data.hasNext) ? (
        <nav className={styles.pagination} aria-label="Notification delivery pages">
          {data.page > 1 ? <PortalActionLink href={notificationsHref(data.page - 1, selectedStatus)} variant="secondary">Previous page</PortalActionLink> : <span />}
          {data.hasNext ? <PortalActionLink href={notificationsHref(data.page + 1, selectedStatus)} variant="secondary">Next page</PortalActionLink> : <span />}
        </nav>
      ) : null}
    </section>
  );
}
