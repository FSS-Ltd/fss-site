import { currencySymbol, type Currency } from "../money";
/** Exact twelfths of a penny support every contracted recurrence without rounding. */
export const METRIC_DEFINITION_VERSION = "operations-2026-09-08.1";
export const MRR_UNITS_PER_PENNY = BigInt(12);
export type Ratio = { numerator: bigint; denominator: bigint } | null;
export function ratio(numerator: bigint, denominator: bigint): Ratio {
  return denominator === BigInt(0) ? null : { numerator, denominator };
}
export function formatRatio(value: Ratio): string {
  if (!value) return "N/A";
  const tenths =
    (value.numerator * BigInt(1000) + value.denominator / BigInt(2)) /
    value.denominator;
  return `${tenths / BigInt(10)}${tenths % BigInt(10) ? `.${tenths % BigInt(10)}` : ""}%`;
}
export function formatMoney(
  pence: bigint,
  unitsPerPenny = BigInt(1),
  currency: Currency = "GBP",
): string {
  const negative = pence < BigInt(0);
  const absolute = negative ? -pence : pence;
  const rounded = (absolute + unitsPerPenny / BigInt(2)) / unitsPerPenny;
  return `${negative ? "−" : ""}${currencySymbol(currency)}${(rounded / BigInt(100)).toLocaleString("en-GB")}.${String(rounded % BigInt(100)).padStart(2, "0")}`;
}
export function londonDate(instant: string | Date): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid observation time.");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function freshness(
  lastSuccess: string | null,
  now: string,
): "unknown" | "stale" | "current" {
  if (!lastSuccess) return "unknown";
  const elapsed = Date.parse(now) - Date.parse(lastSuccess);
  return !Number.isFinite(elapsed) || elapsed < 0
    ? "unknown"
    : elapsed > 86400000
      ? "stale"
      : "current";
}
export function displayReconciliation(units: readonly bigint[]): {
  totalPence: bigint;
  adjustmentPence: bigint;
} {
  const exact = units.reduce((sum, value) => sum + value, BigInt(0));
  const totalPence = (exact + BigInt(6)) / BigInt(12);
  const rows = units.reduce(
    (sum, value) => sum + (value + BigInt(6)) / BigInt(12),
    BigInt(0),
  );
  return { totalPence, adjustmentPence: totalPence - rows };
}
export function formatReportTime(instant: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}
