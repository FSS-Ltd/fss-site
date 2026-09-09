import { londonDate, ratio, type Ratio } from "./definitions";
export type InvoiceEvidence = {
  totalPence: bigint;
  status: string;
  dueDate: string | null;
  allocations: readonly { id: string; pence: bigint; confirmedAt: string }[];
  credits: readonly { id: string; pence: bigint; valid: boolean }[];
};
export function invoiceBalance(invoice: InvoiceEvidence): bigint {
  if (invoice.status === "void" || invoice.status === "draft") return BigInt(0);
  const paid = [
    ...new Map(invoice.allocations.map((a) => [a.id, a])).values(),
  ].reduce((sum, a) => sum + a.pence, BigInt(0));
  const credits = [
    ...new Map(invoice.credits.map((c) => [c.id, c])).values(),
  ].reduce((sum, c) => sum + (c.valid ? c.pence : BigInt(0)), BigInt(0));
  const balance = invoice.totalPence - paid - credits;
  return balance > BigInt(0) ? balance : BigInt(0);
}
export function daysLate(dueDate: string, paidOrObservedAt: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${londonDate(paidOrObservedAt)}T00:00:00Z`) -
        Date.parse(`${dueDate}T00:00:00Z`)) /
        86400000,
    ),
  );
}
export const AGE_BANDS = [
  "current",
  "1–7",
  "8–30",
  "31–60",
  "61–90",
  "91+",
] as const;
export function ageBand(days: number): (typeof AGE_BANDS)[number] {
  return days <= 0
    ? "current"
    : days <= 7
      ? "1–7"
      : days <= 30
        ? "8–30"
        : days <= 60
          ? "31–60"
          : days <= 90
            ? "61–90"
            : "91+";
}
export function onTimeRate(
  invoices: readonly {
    status: string;
    whollyCredited: boolean;
    dueDate: string | null;
    fullyPaidAt: string | null;
  }[],
  fromDate: string,
  toDate: string,
): Ratio {
  const eligible = invoices.filter(
    (i) =>
      i.status !== "void" &&
      i.status !== "draft" &&
      !i.whollyCredited &&
      i.dueDate &&
      i.dueDate >= fromDate &&
      i.dueDate <= toDate,
  );
  const paid = eligible.filter(
    (i) => i.fullyPaidAt && i.dueDate && londonDate(i.fullyPaidAt) <= i.dueDate,
  );
  return ratio(BigInt(paid.length), BigInt(eligible.length));
}
