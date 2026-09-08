import { invoiceStatus, type InvoiceSummary } from "./presentation";
import styles from "./billing.module.css";
export function PaymentStatus({
  invoice,
}: {
  invoice: Pick<InvoiceSummary, "status" | "amountPaidPence" | "paymentState">;
}): React.JSX.Element {
  return (
    <span className={styles.status} data-status={invoice.status}>
      {invoiceStatus(invoice)}
    </span>
  );
}
