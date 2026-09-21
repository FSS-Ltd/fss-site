import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import type { StudioBillingOperations } from "@/lib/operations/studio/operations-queues";
import styles from "./operations-queues.module.css";

function money(value: string): string {
  const pence = Number(value);
  if (!Number.isSafeInteger(pence)) return "Amount unavailable";
  return new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(pence / 100);
}

function date(value: string | null): string {
  if (!value) return "Due date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed);
}

function exceptionTone(category: string): "warning" | "error" {
  return category.includes("overdue") || category.includes("uncollectible")
    ? "error"
    : "warning";
}

export function BillingOperations({
  data,
}: Readonly<{ data: StudioBillingOperations }>): React.JSX.Element {
  return (
    <section className={styles.page} aria-labelledby="studio-billing-heading">
      <PageHeader
        description="Retained invoice figures and provider reconciliation evidence. Payment state remains provider-owned."
        eyebrow="FSS Studio · Billing"
        title="Billing operations"
      />
      <section className={styles.metrics} aria-label="Billing totals">
        <PortalCard title="Due this month">
          <p className={styles.metric}>{money(data.dueThisMonthPence)}</p>
        </PortalCard>
        <PortalCard title="Overdue">
          <p className={styles.metric}>{money(data.overduePence)}</p>
        </PortalCard>
        <PortalCard title="Needs reconciliation">
          <p className={styles.metric}>{data.reconciliationCount}</p>
        </PortalCard>
      </section>
      <Notice tone="warning">
        <strong>Provider reconciliation required.</strong> Review retained
        provider evidence before retrying any uncertain collection operation.
        This workspace cannot mark an invoice paid.
      </Notice>
      {data.items.length === 0 ? (
        <PortalCard title="No open billing exceptions">
          <p className={styles.empty}>There are no unresolved billing exceptions in this workspace.</p>
        </PortalCard>
      ) : (
        <ul className={styles.list} aria-label="Billing exception queue">
          {data.items.map((item) => (
            <li key={item.id}>
              <PortalCard>
                <div className={styles.row}>
                  <div className={styles.rowSummary}>
                    <h2>{item.organisationName ?? "Unassigned organisation"}</h2>
                    <p>{item.category.replaceAll("_", " ")}</p>
                    <StatusBadge status={exceptionTone(item.category)}>
                      Needs review
                    </StatusBadge>
                  </div>
                  <dl className={styles.rowMeta}>
                    <div><dt>Invoice</dt><dd>{item.providerReference ?? "Not retained"}</dd></div>
                    <div><dt>Outstanding</dt><dd>{item.amountPence ? money(item.amountPence) : "Unavailable"}</dd></div>
                    <div><dt>Due</dt><dd>{date(item.dueDate)}</dd></div>
                  </dl>
                  {item.organisationId ? (
                    <PortalActionLink href={portalPath(`/portal/admin/clients/${item.organisationId}`)}>
                      Client context
                    </PortalActionLink>
                  ) : null}
                </div>
              </PortalCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
