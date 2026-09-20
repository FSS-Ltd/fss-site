import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/studio-client.module.css";
import { StudioPagination } from "@/components/portal/workspace/studio-pagination";
import { studioDateLabel } from "@/components/portal/workspace/studio-date";
import workspace from "@/components/portal/workspace/workspace.module.css";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { parseWorkspacePage } from "@/lib/operations/workspaces/pagination";
import { listStaffNotificationDeliveries } from "@/lib/operations/workspaces/staff-repository";

export const dynamic = "force-dynamic";

const deliveryStatuses = ["pending", "succeeded", "held"] as const;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const params = await searchParams;
  const data = await (async () => {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    const enabled = process.env.OPERATIONS_REQUEST_EMAILS_ENABLED === "true";
    if (!enabled) return { available: false as const };
    const rawStatus = Array.isArray(params.status) ? undefined : params.status;
    const status = z
      .enum(deliveryStatuses)
      .optional()
      .parse(rawStatus === "all" ? undefined : rawStatus);
    const deliveries = await listStaffNotificationDeliveries(db, admin, {
      status,
      page: parseWorkspacePage(params.page),
    });
    return { available: true as const, deliveries, rawStatus, status };
  })().catch(() => null);
  if (!data) return <PortalUnavailable />;
  if (!data.available) {
    return (
      <section
        className={styles.page}
        aria-labelledby="studio-notifications-heading"
      >
        <header className={styles.hero}>
          <p className={styles.eyebrow}>FSS Studio · Notifications</p>
          <h1 className={styles.title} id="studio-notifications-heading">
            Notifications
          </h1>
          <p className={styles.description}>
            Request email delivery is unavailable until the dedicated email
            provider gate is enabled. In-app request updates remain scoped to
            each client workspace.
          </p>
        </header>
      </section>
    );
  }
  const { deliveries, rawStatus, status } = data;
  return (
    <section
      className={styles.page}
      aria-labelledby="studio-notifications-heading"
    >
      <header className={styles.hero}>
        <p className={styles.eyebrow}>FSS Studio · Notifications</p>
        <h1 className={styles.title} id="studio-notifications-heading">
          Email delivery record
        </h1>
        <p className={styles.description}>
          Delivery status is retained separately from in-app notifications so
          provider failures stay visible without changing request history.
        </p>
      </header>
      <form className={workspace.filterForm} method="get">
        <label>
          Delivery status
          <select defaultValue={rawStatus ?? "all"} name="status">
            <option value="all">All statuses</option>
            {deliveryStatuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply filter</button>
      </form>
      {deliveries.items.length === 0 ? (
        <p className={styles.rowCopy}>
          No request email deliveries match this workspace view.
        </p>
      ) : (
        <ul className={styles.rowList}>
          {deliveries.items.map((delivery) => (
            <li className={styles.row} key={delivery.id}>
              <div className={styles.rowContent}>
                <h2 className={styles.rowTitle}>{delivery.requestTitle}</h2>
                <p className={styles.rowCopy}>
                  {delivery.organisationName} ·{" "}
                  {delivery.kind.replaceAll("_", " ")} · {delivery.status}
                </p>
                <p className={styles.rowCopy}>
                  {delivery.attempts}{" "}
                  {delivery.attempts === 1 ? "attempt" : "attempts"} · Last
                  {" updated "}
                  {studioDateLabel(delivery.updatedAt)}
                </p>
              </div>
              <Link
                className={styles.actionLink}
                href={`/admin/clients/${delivery.organisationId}/requests/${delivery.requestId}`}
              >
                Open request
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StudioPagination
        filter={{ status }}
        hasNext={deliveries.hasNext}
        page={deliveries.page}
        path="/admin/notifications"
      />
    </section>
  );
}
