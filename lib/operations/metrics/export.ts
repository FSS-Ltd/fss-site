import type { ReceivableRow } from "./snapshot-types";
/** Quote every field, neutralize formulas even after whitespace/control prefixes. */
export function csvCell(value: string): string {
  const safe =
    /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function receivablesCsv(
  rows: readonly ReceivableRow[],
  generatedAt: string,
  definitionVersion: string,
): string {
  const table = [
    ["Generated at", generatedAt],
    ["Definition version", definitionVersion],
    ["Currency", "GBP"],
    [
      "Invoice",
      "Client",
      "Due date",
      "Gross pence",
      "Credit pence",
      "Paid pence",
      "Remaining pence",
      "Payment state",
      "Disputed",
      "Owner",
    ],
    ...rows.map((r) => [
      r.number ?? "",
      r.client,
      r.dueDate ?? "",
      r.gross,
      r.credit,
      r.paid,
      r.remaining,
      r.paymentState,
      String(r.dispute),
      r.owner,
    ]),
  ];
  return table.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
