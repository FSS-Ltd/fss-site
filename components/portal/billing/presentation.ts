import type {
  BillingInvoice,
  BillingInvoiceDetail,
} from "@/lib/operations/billing/domain-types";
import { penceToGbp } from "@/lib/operations/agreements/money-input";

export type InvoiceSummary = Omit<BillingInvoice, "providerInvoiceId">;
export type InvoiceDetail = Omit<BillingInvoiceDetail, "providerInvoiceId">;

export function toInvoiceSummary(invoice: BillingInvoice): InvoiceSummary {
  return {
    amountDuePence: invoice.amountDuePence,
    amountOverpaidPence: invoice.amountOverpaidPence,
    amountPaidPence: invoice.amountPaidPence,
    amountRemainingPence: invoice.amountRemainingPence,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    id: invoice.id,
    mandateState: invoice.mandateState,
    number: invoice.number,
    paymentState: invoice.paymentState,
    projectedAt: invoice.projectedAt,
    status: invoice.status,
    totalPence: invoice.totalPence,
  };
}

export function toInvoiceDetail(invoice: BillingInvoiceDetail): InvoiceDetail {
  return {
    ...toInvoiceSummary(invoice),
    issuedAt: invoice.issuedAt,
    lines: invoice.lines,
  };
}

export function nextOpenInvoice(
  invoices: readonly InvoiceSummary[],
): InvoiceSummary | null {
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  return (
    [...openInvoices].sort((left, right) => {
      if (!left.dueDate && !right.dueDate) return 0;
      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;
      return left.dueDate.localeCompare(right.dueDate);
    })[0] ?? null
  );
}
export function billingAmount(pence: string): string {
  const [whole, fraction] = penceToGbp(pence).split(".");
  return `£${new Intl.NumberFormat("en-GB").format(BigInt(whole))}.${fraction}`;
}
export function billingDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(date));
}
export function invoiceStatus(
  invoice: Pick<InvoiceSummary, "status" | "amountPaidPence" | "paymentState">,
): string {
  switch (invoice.status) {
    case "paid":
      return "Paid";
    case "void":
      return "Voided";
    case "uncollectible":
      return "Contact FSS";
    case "draft":
      return "Preparing";
    case "open":
      if (invoice.paymentState === "processing") return "Payment processing";
      if (invoice.paymentState === "pending") return "Payment pending";
      if (invoice.paymentState === "failed") return "Payment failed";
      return BigInt(invoice.amountPaidPence) > BigInt(0)
        ? "Part paid"
        : "Awaiting payment";
  }
}
