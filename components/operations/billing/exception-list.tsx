import Link from "next/link";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import type { BillingException } from "@/lib/operations/billing/exception-repository";
import { billingDate } from "@/components/portal/billing/presentation";
import {
  DashboardMetric,
  DistributionBars,
  DonutChart,
} from "../dashboard/dashboard-visuals";
import styles from "../clients/client-list.module.css";
import billingStyles from "./exception-list.module.css";

const descriptions: Record<string, string> = {
  unknown_mapping:
    "Match this provider record to its client and signed billing schedule.",
  scope_mismatch:
    "Check the provider account and environment before processing this record.",
  incomplete_provider_data:
    "The provider returned an incomplete record. Review it before reconciling.",
  invalid_projection:
    "The provider record could not be safely applied. Review its financial details.",
  provider_unavailable:
    "Automatic processing could not finish. Check provider availability before replaying.",
  refund_review: "Review the refund and its allocation against the invoice.",
  overpayment_review:
    "Review the extra payment and agree whether to refund it or apply a credit.",
  dispute_review:
    "Review the dispute in Stripe and follow its response deadline.",
  uncollectible_review:
    "Review this uncollectible invoice and agree the next step with the client.",
  overdue_review:
    "This invoice is overdue. Review the client’s circumstances before following up.",
  provider_retry_review:
    "Review Stripe’s retry schedule. The Direct Debit mandate remains active.",
  new_mandate_required:
    "A new Direct Debit authorisation is needed before another collection.",
  payment_method_required:
    "The client needs to update or authorise their payment method.",
};

function categoryLabel(category: string): string {
  return category.replaceAll("_", " ");
}

function BillingSummary({
  rows,
}: {
  rows: readonly BillingException[];
}): React.JSX.Element | null {
  if (rows.length === 0) return null;

  const mapped = rows.filter((item) => item.organisationId !== null).length;
  const live = rows.filter((item) => item.mode === "live").length;
  const byCategory = new Map<string, number>();

  for (const item of rows) {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
  }

  return (
    <section
      className={billingStyles.summary}
      aria-labelledby="billing-summary-heading"
    >
      <div className={billingStyles.summaryHeading}>
        <p className={styles.eyebrow}>Exception overview</p>
        <h2 id="billing-summary-heading">Resolve the work that affects cash</h2>
        <p>
          This page is a review queue, not an automated collection workflow.
          Confirm the record and next step before any client contact.
        </p>
      </div>
      <div className={billingStyles.metrics}>
        <DashboardMetric
          label="Exceptions shown"
          supportingText="Open billing exceptions in the current review page."
          value={rows.length.toLocaleString("en-GB")}
        />
        <DashboardMetric
          label="Client mapping"
          signal={
            mapped === rows.length
              ? { label: "All shown records are linked", tone: "positive" }
              : {
                  label: `${rows.length - mapped} record${rows.length - mapped === 1 ? " needs" : "s need"} a client link`,
                  tone: "warning",
                }
          }
          supportingText="Exceptions already associated with a client organisation."
          value={`${mapped} / ${rows.length}`}
        />
        <DashboardMetric
          label="Live-provider records"
          signal={
            live > 0
              ? { label: "Confirm live impact before acting", tone: "critical" }
              : { label: "No live-provider records shown", tone: "positive" }
          }
          supportingText="Exceptions from the live Stripe account, not test data."
          value={live.toLocaleString("en-GB")}
        />
      </div>
      <div className={billingStyles.visuals}>
        <DonutChart
          centerLabel="Records"
          description={`${mapped.toLocaleString("en-GB")} of ${rows.length.toLocaleString("en-GB")} open exceptions on this page already identify the client record needed for follow-up.`}
          segments={[
            { label: "Client linked", tone: "positive", value: mapped },
            {
              label: "Client mapping needed",
              tone: "warning",
              value: rows.length - mapped,
            },
          ]}
          title="Client mapping coverage"
        />
        <DistributionBars
          description="The categories identify the type of review to perform before a decision is recorded."
          items={[...byCategory.entries()]
            .sort(([, a], [, b]) => b - a)
            .map(([category, value]) => ({
              label: categoryLabel(category),
              tone:
                category === "dispute_review" || category === "overdue_review"
                  ? ("critical" as const)
                  : category === "unknown_mapping" ||
                      category === "provider_unavailable"
                    ? ("warning" as const)
                    : ("brand" as const),
              value,
            }))}
          title="Exception reasons"
        />
      </div>
    </section>
  );
}

export function BillingExceptionList({
  state,
}: {
  state:
    | { status: "error" }
    | { status: "ready"; rows: BillingException[]; nextCursor: string | null };
}): React.JSX.Element {
  return (
    <section
      className={`${sharedStyles.page} ${styles.page} ${billingStyles.page}`}
    >
      <OperationsPageHeader
        context="Growth · Operations · Billing"
        title="Needs your attention"
        description="Payment exceptions and collection decisions, ready for review."
        action={
          <nav className={styles.headerActions} aria-label="Billing review">
            <Link href="/growth/operations/clients">Client register</Link>
          </nav>
        }
      />
      <p className={`${sharedStyles.panel} ${billingStyles.safety}`}>
        Stripe manages payment reminders and retries. Review items do not send
        messages, suspend services or start legal action.
      </p>
      {state.status === "error" ? (
        <div
          className={`${sharedStyles.errorState} ${styles.notice}`}
          role="alert"
        >
          <p>Billing review could not load.</p>
          <Link href="/growth/operations/billing">Try again</Link>
        </div>
      ) : (
        <>
          <BillingSummary rows={state.rows} />
          {state.rows.length === 0 ? (
            <div className={`${sharedStyles.emptyState} ${styles.notice}`}>
              <h2>No open items on this page</h2>
              <p>
                New payment exceptions will appear here after reconciliation.
              </p>
              <Link href="/growth/operations/billing">View first page</Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {state.rows.map((item) => (
                <li key={item.id} className={billingStyles.item}>
                  <div className={billingStyles.itemHeading}>
                    <h2 className={styles.name}>
                      {item.organisationName ?? "Client mapping needed"}
                    </h2>
                    <div className={billingStyles.signals}>
                      <span
                        data-tone={item.organisationId ? "positive" : "warning"}
                      >
                        {item.organisationId ? "Client linked" : "Mapping needed"}
                      </span>
                      <span
                        data-tone={item.mode === "live" ? "critical" : "neutral"}
                      >
                        {item.mode === "live" ? "Live provider" : "Test provider"}
                      </span>
                    </div>
                  </div>
                  <p>
                    {descriptions[item.category] ??
                      "Review this payment record before taking further action."}
                  </p>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Environment</dt>
                      <dd>{item.mode === "test" ? "Test" : "Live"}</dd>
                    </div>
                    <div>
                      <dt>Provider reference</dt>
                      <dd>{item.objectId}</dd>
                    </div>
                    <div>
                      <dt>First seen</dt>
                      <dd>
                        <time dateTime={item.createdAt}>
                          {billingDate(item.createdAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>Last checked</dt>
                      <dd>
                        <time dateTime={item.lastSeenAt}>
                          {billingDate(item.lastSeenAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  {item.organisationId && (
                    <Link
                      href={`/growth/operations/clients/${item.organisationId}/agreements`}
                    >
                      Review client agreements
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {state.nextCursor && (
            <nav
              className={styles.pagination}
              aria-label="Billing review pages"
            >
              <Link
                href={`/growth/operations/billing?after=${encodeURIComponent(state.nextCursor)}`}
              >
                Next page
              </Link>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
