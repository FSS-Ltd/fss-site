import Link from "next/link";
import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { ReceivableSummary } from "@/lib/operations/metrics/snapshot-types";
import styles from "./overview.module.css";
export function ReceivablesTable({
  data,
}: {
  data: ReceivableSummary | null;
}): React.JSX.Element {
  return (
    <section id="receivables" className={styles.section}>
      <h2>Receivables</h2>
      {!data ? (
        <p>
          Receivables are unavailable for this provider scope or historical
          observation date.
        </p>
      ) : (
        <>
          <p>
            All matching invoices: {data.totalRows.toLocaleString("en-GB")}.
            Outstanding total: {formatMoney(BigInt(data.outstanding))}. Overdue:{" "}
            {formatMoney(BigInt(data.overdue))}.
          </p>
          <p>
            On-time payment:{" "}
            {data.unknownPunctuality
              ? "Unavailable: missing satisfaction timestamps"
              : formatRatio(
                  ratio(BigInt(data.onTime), BigInt(data.eligible)),
                )}{" "}
            · {data.onTime} on time / {data.eligible} eligible invoices due in
            period.
          </p>
          <p>
            Next retry is unavailable in the captured provider projection.
            Issued gross, provider-applied paid and current remaining balances
            are shown separately; customer account balances may change the
            amount due.
          </p>
          <ul>
            {data.ageing.map((b) => (
              <li key={b.band}>
                {b.band} days: {formatMoney(BigInt(b.total))}
              </li>
            ))}
          </ul>
          <div
            className={styles.scroll}
            tabIndex={0}
            role="region"
            aria-label="Receivables table, scroll horizontally"
          >
            <table>
              <caption>
                Current projected balances, GBP. Totals include every matching
                invoice, across all pages.
              </caption>
              <thead>
                <tr>
                  {[
                    "Invoice / client",
                    "Issue / due",
                    "Gross",
                    "Credit",
                    "Paid",
                    "Remaining",
                    "Days late",
                    "Payment / dispute",
                    "Owner",
                  ].map((x) => (
                    <th scope="col" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <Link
                        href={`/growth/operations/clients/${row.organisationId}/agreements`}
                      >
                        {row.number ?? "Unnumbered"} · {row.client}
                      </Link>
                    </th>
                    <td>
                      {row.issuedDate ?? "Unknown"} / {row.dueDate ?? "Unknown"}
                    </td>
                    {[row.gross, row.credit, row.paid, row.remaining].map(
                      (v, i) => (
                        <td key={i}>{formatMoney(BigInt(v))}</td>
                      ),
                    )}
                    <td>{row.daysLate ?? "Unknown"}</td>
                    <td>
                      {row.paymentState}
                      {row.dispute ? " · Disputed" : ""}
                    </td>
                    <td>{row.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.rows.length === 0 ? <p>No invoices on this page.</p> : null}
        </>
      )}
    </section>
  );
}
