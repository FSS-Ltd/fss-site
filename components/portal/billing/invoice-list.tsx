import { FileText } from "lucide-react";
import { PaymentStatus } from "./payment-status";
import { HostedBillingAction } from "./hosted-action";
import {
  billingAmount,
  billingDate,
  type InvoiceSummary,
} from "./presentation";
import styles from "./billing.module.css";

export function InvoiceList({
  invoices,
  organisationId,
}: {
  invoices: InvoiceSummary[];
  organisationId: string;
}): React.JSX.Element {
  if (!invoices.length)
    return (
      <div className={styles.empty}>
        <FileText size={28} strokeWidth={1.4} aria-hidden="true" />
        <h3>No invoices yet</h3>
        <p>Your invoices will appear here once they have been issued.</p>
      </div>
    );
  return (
    <ul className={styles.invoices} aria-label="Invoices">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <div className={styles.invoiceHeading}>
            <h3>{invoice.number ?? "Invoice being prepared"}</h3>
            <PaymentStatus invoice={invoice} />
          </div>
          <p className={styles.amount}>{billingAmount(invoice.totalPence)}</p>
          <dl className={styles.details}>
            {invoice.dueDate && (
              <div>
                <dt>Due</dt>
                <dd>
                  <time dateTime={invoice.dueDate}>
                    {billingDate(invoice.dueDate)}
                  </time>
                </dd>
              </div>
            )}
            <div>
              <dt>Paid</dt>
              <dd>{billingAmount(invoice.amountPaidPence)}</dd>
            </div>
            {invoice.status === "open" && (
              <div>
                <dt>Remaining</dt>
                <dd>{billingAmount(invoice.amountRemainingPence)}</dd>
              </div>
            )}
          </dl>
          <div className={styles.invoiceFooter}>
            <p>
              Last checked{" "}
              <time dateTime={invoice.projectedAt}>
                {billingDate(invoice.projectedAt)}
              </time>
            </p>
            {invoice.status !== "draft" && (
              <HostedBillingAction
                command={{
                  action: "invoice",
                  organisationId,
                  invoiceId: invoice.id,
                }}
              >
                View invoice
                <span className={styles.srOnly}>
                  {" "}
                  {invoice.number ?? "details"}
                </span>
              </HostedBillingAction>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
