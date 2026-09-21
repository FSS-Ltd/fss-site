import { FileText } from "lucide-react";
import { PortalActionLink, PortalCard } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import { PaymentStatus } from "./payment-status";
import {
  billingAmount,
  billingDate,
  type InvoiceSummary,
} from "./presentation";
import styles from "./billing.module.css";

function invoiceHref(invoiceId: string, organisationId: string): string {
  const search = new URLSearchParams({ organisationId });
  return `${portalPath(`/portal/billing/invoices/${invoiceId}`)}?${search.toString()}`;
}

export function InvoiceList({
  invoices,
  organisationId,
}: {
  invoices: readonly InvoiceSummary[];
  organisationId: string;
}): React.JSX.Element {
  if (!invoices.length)
    return (
      <PortalCard title="No invoices yet">
        <div className={styles.empty}>
          <FileText size={28} strokeWidth={1.4} aria-hidden="true" />
          <p>Your invoices will appear here once they have been issued.</p>
        </div>
      </PortalCard>
    );

  return (
    <ul className={styles.invoices} aria-label="Invoices">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <PortalCard className={styles.invoiceCard}>
            <div className={styles.invoiceHeading}>
              <h3>{invoice.number ?? "Invoice being prepared"}</h3>
              <PaymentStatus invoice={invoice} />
            </div>
            <p className={styles.amount}>{billingAmount(invoice.totalPence)}</p>
            <dl className={styles.details}>
              {invoice.amountDuePence !== invoice.totalPence ? (
                <div>
                  <dt>Amount due, including account balance</dt>
                  <dd>{billingAmount(invoice.amountDuePence)}</dd>
                </div>
              ) : null}
              {invoice.dueDate ? (
                <div>
                  <dt>Due</dt>
                  <dd>
                    <time dateTime={invoice.dueDate}>
                      {billingDate(invoice.dueDate)}
                    </time>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Paid</dt>
                <dd>{billingAmount(invoice.amountPaidPence)}</dd>
              </div>
              {BigInt(invoice.amountOverpaidPence) > BigInt(0) ? (
                <div>
                  <dt>Overpaid</dt>
                  <dd>{billingAmount(invoice.amountOverpaidPence)}</dd>
                </div>
              ) : null}
              {invoice.status === "open" ? (
                <div>
                  <dt>Remaining</dt>
                  <dd>{billingAmount(invoice.amountRemainingPence)}</dd>
                </div>
              ) : null}
            </dl>
            {BigInt(invoice.amountOverpaidPence) > BigInt(0) ? (
              <p className={styles.note}>
                We’re reviewing the extra payment. Please contact FSS before
                making another payment.
              </p>
            ) : null}
            {invoice.paymentState === "processing" ? (
              <p className={styles.note}>
                Payment processing. Please wait for confirmation before making
                another payment.
              </p>
            ) : null}
            {invoice.paymentState === "pending" ? (
              <p className={styles.note}>
                Payment pending. Your invoice will update after confirmation.
              </p>
            ) : null}
            {invoice.paymentState === "failed" && invoice.status === "open" ? (
              <p className={styles.note}>
                The payment did not complete. Review your payment method or
                contact FSS.
              </p>
            ) : null}
            {invoice.mandateState ? (
              <p className={styles.note}>
                Direct Debit authorisation:{" "}
                {invoice.mandateState === "active"
                  ? "active"
                  : invoice.mandateState === "pending"
                    ? "pending confirmation"
                    : "new consent required"}
                .
              </p>
            ) : null}
            <div className={styles.invoiceFooter}>
              <p>
                Last checked{" "}
                <time dateTime={invoice.projectedAt}>
                  {billingDate(invoice.projectedAt)}
                </time>
              </p>
              {invoice.status !== "draft" ? (
                <PortalActionLink
                  href={invoiceHref(invoice.id, organisationId)}
                  variant="secondary"
                >
                  View invoice
                  <span className={styles.srOnly}>
                    {" "}
                    {invoice.number ?? "details"}
                  </span>
                </PortalActionLink>
              ) : null}
            </div>
          </PortalCard>
        </li>
      ))}
    </ul>
  );
}
