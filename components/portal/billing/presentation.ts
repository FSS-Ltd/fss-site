import type { BillingInvoice } from "@/lib/operations/billing/domain-types";
import { penceToGbp } from "@/lib/operations/agreements/money-input";

export type InvoiceSummary = Omit<BillingInvoice, "providerInvoiceId">;
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
  invoice: Pick<InvoiceSummary, "status" | "amountPaidPence">,
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
      return BigInt(invoice.amountPaidPence) > BigInt(0)
        ? "Part paid"
        : "Awaiting payment";
  }
}
