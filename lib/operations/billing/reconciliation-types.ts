import type { Currency } from "../money";
import type Stripe from "stripe";
import type { BillingMode } from "./types";

export type ProviderScope = { accountId: string; mode: BillingMode };
export type BillingEventReceipt = ProviderScope & {
  eventId: string;
  eventType: string;
  objectId: string;
  payloadHash: string;
  occurredAt: string;
};
export type PaymentProjection = {
  currency: Currency;
  providerId: string;
  customerId: string;
  state: "pending" | "processing" | "succeeded" | "failed" | "canceled";
  method: "card" | "bacs_debit" | "other";
  amountPence: string;
  receivedPence: string;
  confirmedAt: string | null;
  failureCode: string | null;
  providerMandateId: string | null;
  createdAt: string;
  observedAt: string;
  allocationId: string;
  allocationPence: string;
  refunds: {
    providerId: string;
    currency: Currency;
    amountPence: string;
    status: string;
  }[];
  disputes: {
    providerId: string;
    currency: Currency;
    amountPence: string;
    status: string;
  }[];
};
export type MandateProjection = {
  providerId: string;
  customerId: string;
  status: "active" | "inactive" | "pending";
  observedAt: string;
};
export type InvoiceReconciliation = {
  invoice: Stripe.Invoice;
  customerId: string;
  subscriptionId: string | null;
  subscriptionScheduleId: string | null;
  payments: PaymentProjection[];
  mandates: MandateProjection[];
  credits: {
    providerId: string;
    currency: Currency;
    amountPence: string;
    status: string;
  }[];
};
export type BillingReconciliationProvider = {
  scope: ProviderScope;
  resolveEvent(
    receipt: BillingEventReceipt,
  ): Promise<{ invoiceIds: string[]; mandate: MandateProjection | null }>;
  fetchInvoice(invoiceId: string): Promise<InvoiceReconciliation>;
  listInvoices(
    cursor: string | null,
    limit: number,
  ): Promise<{ invoiceIds: string[]; cursor: string | null }>;
};
export class BillingReconciliationError extends Error {
  constructor(
    readonly code:
      | "unknown_mapping"
      | "scope_mismatch"
      | "incomplete_provider_data"
      | "invalid_projection",
  ) {
    super(code);
  }
}
