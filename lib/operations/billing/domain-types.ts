import type { Currency } from "../money";
import type { BillingMode } from "./types";
export type BillingScope = {
  organisationId: string;
  accountId: string;
  mode: BillingMode;
};
export type BillingCustomer = BillingScope & {
  currency: Currency;
  id: string;
  providerCustomerId: string;
};
export type BillingObligation = {
  currency: Currency;
  key: string;
  owner: "invoice" | "subscription";
  amountPence: string;
  dueDate: string;
  endDate: string | null;
  recurrenceMonths: 0 | 1 | 3 | 12;
  description: string;
};
export type BillingSchedule = BillingObligation &
  BillingScope & {
    id: string;
    agreementId: string;
    revision: number;
    providerReference: string | null;
  };
export type BillingInvoice = {
  id: string;
  providerInvoiceId: string;
  number: string | null;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  currency: Currency;
  totalPence: string;
  amountDuePence: string;
  amountOverpaidPence: string;
  amountPaidPence: string;
  amountRemainingPence: string;
  dueDate: string | null;
  projectedAt: string;
  paymentState:
    | "pending"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled"
    | null;
  mandateState: "pending" | "active" | "inactive" | null;
};

export type BillingInvoiceDetail = BillingInvoice & {
  issuedAt: string | null;
  lines: ReadonlyArray<{
    amountPence: string;
    description: string | null;
  }>;
};
