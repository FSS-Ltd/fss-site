import { invoiceStatus, type InvoiceSummary } from "./presentation";
import { StatusBadge, type PortalStatus } from "@/components/portal/ui";
export function PaymentStatus({
  invoice,
}: {
  invoice: Pick<InvoiceSummary, "status" | "amountPaidPence" | "paymentState">;
}): React.JSX.Element {
  const status: PortalStatus =
    invoice.status === "paid"
      ? "success"
      : invoice.paymentState === "failed" || invoice.status === "uncollectible"
        ? "error"
        : invoice.paymentState === "pending" ||
            invoice.paymentState === "processing"
          ? "warning"
          : "info";
  return <StatusBadge status={status}>{invoiceStatus(invoice)}</StatusBadge>;
}
