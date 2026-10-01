import { formatMoney } from "@/lib/operations/money";
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

function date(value: string | null): string {
  if (!value) return "Due date unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    parsed,
  );
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
          {data.totalsByCurrency.length ? (
            data.totalsByCurrency.map((total) => (
              <p className={styles.metric} key={total.currency}>
                {formatMoney(total.dueThisMonthPence, total.currency)}{" "}
                <small>{total.currency}</small>
              </p>
            ))
          ) : (
            <p className={styles.metric}>No invoices</p>
          )}
        </PortalCard>
        <PortalCard title="Overdue">
          {data.totalsByCurrency.length ? (
            data.totalsByCurrency.map((total) => (
              <p className={styles.metric} key={total.currency}>
                {formatMoney(total.overduePence, total.currency)}{" "}
                <small>{total.currency}</small>
              </p>
            ))
          ) : (
            <p className={styles.metric}>No invoices</p>
          )}
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
          <p className={styles.empty}>
            There are no unresolved billing exceptions in this workspace.
          </p>
        </PortalCard>
      ) : (
        <ul className={styles.list} aria-label="Billing exception queue">
          {data.items.map((item) => (
            <li key={item.id}>
              <PortalCard>
                <div className={styles.row}>
                  <div className={styles.rowSummary}>
                    <h2>
                      {item.organisationName ?? "Unassigned organisation"}
                    </h2>
                    <p>{item.category.replaceAll("_", " ")}</p>
                    <StatusBadge status={exceptionTone(item.category)}>
                      Needs review
                    </StatusBadge>
                  </div>
                  <dl className={styles.rowMeta}>
                    <div>
                      <dt>Invoice</dt>
                      <dd>{item.providerReference ?? "Not retained"}</dd>
                    </div>
                    <div>
                      <dt>Outstanding</dt>
                      <dd>
                        {item.amountPence && item.currency
                          ? formatMoney(item.amountPence, item.currency)
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd>{date(item.dueDate)}</dd>
                    </div>
                  </dl>
                  {item.organisationId ? (
                    <PortalActionLink
                      href={portalPath(
                        `/portal/admin/clients/${item.organisationId}`,
                      )}
                    >
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
