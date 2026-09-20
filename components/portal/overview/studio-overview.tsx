import Link from "next/link";
import { portalPath } from "@/lib/operations/auth/portal-url";
import {
  getStudioOverviewMetrics,
  selectStudioAttention,
  type StudioAttentionItem,
  type StudioOverview as StudioOverviewData,
} from "@/lib/operations/overview/studio-overview";
import { PageHeader, StatusBadge } from "@/components/portal/ui";
import styles from "./studio-overview.module.css";

type StudioOverviewProps = Readonly<{
  asOf?: Date;
  overview: StudioOverviewData;
}>;

function adminHref(pathname: string): string {
  return portalPath(`/portal/admin${pathname}`);
}

function attentionStatus(
  item: StudioAttentionItem,
): "error" | "info" | "warning" {
  if (item.state === "failed") return "error";
  if (item.state === "overdue") return "warning";
  return "info";
}

function attentionLabel(item: StudioAttentionItem): string {
  if (item.state === "failed") return "Needs recovery";
  if (item.state === "overdue") return "Overdue";
  return "Waiting";
}

function deliveryStateLabel(
  item: StudioOverviewData["delivery"]["items"][number],
): string {
  if (item.blocked) return "Blocked";
  if (item.status === "ready_for_review") return "Waiting on client";
  return item.status.replaceAll("_", " ");
}

export function StudioOverview({
  asOf,
  overview,
}: StudioOverviewProps): React.JSX.Element {
  const attention = selectStudioAttention(overview, asOf);
  const metrics = getStudioOverviewMetrics(overview);

  return (
    <div className={styles.page}>
      <PageHeader
        action={
          <Link className={styles.primaryAction} href={adminHref("/delivery")}>
            Open action queue
          </Link>
        }
        description="Live staff-scoped queues show work that needs a decision. Counts are defined by the queue labels below."
        eyebrow="FSS Studio"
        title="Your studio, in focus."
      />

      <section className={styles.attention} aria-labelledby="attention-heading">
        <div className={styles.attentionHeader}>
          <p className={styles.sectionLabel}>Action queue</p>
          <h2 id="attention-heading">Needs your attention</h2>
        </div>
        {attention.length > 0 ? (
          <ul className={styles.attentionList}>
            {attention.map((item) => (
              <li key={`${item.kind}-${item.href}`}>
                <StatusBadge status={attentionStatus(item)}>
                  {attentionLabel(item)}
                </StatusBadge>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <Link href={item.href}>{item.actionLabel}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            No staff-scoped delivery, signing, billing, or welcome action is
            waiting right now.
          </p>
        )}
      </section>

      <dl className={styles.metricGrid} aria-label="Studio queue definitions">
        {metrics.map((metric) => (
          <div className={styles.metric} key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            <Link href={metric.href}>Open queue</Link>
          </div>
        ))}
      </dl>

      <section className={styles.panel} aria-labelledby="delivery-focus-heading">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.sectionLabel}>Delivery focus</p>
            <h2 id="delivery-focus-heading">Work already in motion</h2>
          </div>
          <Link href={adminHref("/delivery")}>View delivery</Link>
        </div>
        {overview.delivery.items.length > 0 ? (
          <ul className={styles.deliveryList}>
            {overview.delivery.items.slice(0, 3).map((item) => (
              <li key={item.id}>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.organisationName}</p>
                </div>
                <div className={styles.deliveryMeta}>
                  <StatusBadge status={item.blocked ? "error" : "info"}>
                    {deliveryStateLabel(item)}
                  </StatusBadge>
                  <Link href={adminHref(`/clients/${item.organisationId}`)}>
                    Open client
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            There is no active delivery work in the staff queue.
          </p>
        )}
      </section>
    </div>
  );
}
