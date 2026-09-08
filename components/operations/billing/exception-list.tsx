import Link from "next/link";
import type { BillingException } from "@/lib/operations/billing/exception-repository";
import { billingDate } from "@/components/portal/billing/presentation";
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

export function BillingExceptionList({
  state,
}: {
  state:
    | { status: "error" }
    | { status: "ready"; rows: BillingException[]; nextCursor: string | null };
}): React.JSX.Element {
  return (
    <section
      className={`${styles.page} ${billingStyles.page}`}
      aria-labelledby="billing-review-heading"
    >
      <header>
        <Link href="/growth/operations/clients">Client register</Link>
        <p className={styles.eyebrow}>Operations · Billing</p>
        <h1 id="billing-review-heading" className={styles.heading}>
          Needs your attention
        </h1>
        <p className={styles.subtitle}>
          Payment exceptions and collection decisions, ready for review.
        </p>
      </header>
      <p className={styles.detail}>
        Stripe manages payment reminders and retries. Review items do not send
        messages, suspend services or start legal action.
      </p>
      {state.status === "error" ? (
        <div className={styles.notice} role="alert">
          <p>Billing review could not load.</p>
          <Link href="/growth/operations/billing">Try again</Link>
        </div>
      ) : state.rows.length === 0 ? (
        <div className={styles.notice}>
          <h2>No open items on this page</h2>
          <p>New payment exceptions will appear here after reconciliation.</p>
          <Link href="/growth/operations/billing">View first page</Link>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {state.rows.map((item) => (
              <li key={item.id} className={styles.row}>
                <h2 className={styles.name}>
                  {item.organisationName ?? "Client mapping needed"}
                </h2>
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
          {state.nextCursor && (
            <nav aria-label="Billing review pages">
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
