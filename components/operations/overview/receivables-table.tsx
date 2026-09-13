import Link from "next/link";
import {
  formatMoney,
  formatRatio,
  ratio,
} from "@/lib/operations/metrics/definitions";
import type { ReceivableSummary } from "@/lib/operations/metrics/snapshot-types";
import { DonutChart } from "../dashboard/dashboard-visuals";
import styles from "./overview.module.css";

function PaymentTimingChart({
  data,
}: {
  data: ReceivableSummary;
}): React.JSX.Element | null {
  if (data.unknownPunctuality > 0 || BigInt(data.eligible) === BigInt(0))
    return null;

  const eligible = Number(BigInt(data.eligible));
  const onTime = Number(BigInt(data.onTime));
  const late = Math.max(eligible - onTime, 0);

  return (
    <DonutChart
      centerLabel="Invoices"
      description={`${onTime.toLocaleString("en-GB")} of ${eligible.toLocaleString("en-GB")} eligible invoices due in this reporting period were paid on time.`}
      segments={[
        { label: "Paid on time", tone: "positive", value: onTime },
        { label: "Paid late", tone: "warning", value: late },
      ]}
      title="Payment timing"
    />
  );
}
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
          <div className={styles.receivablesSummary}>
            <PaymentTimingChart data={data} />
            <section className={styles.ageing} aria-labelledby="ageing-heading">
              <h3 id="ageing-heading">Outstanding balance by age</h3>
              <p>Age bands show where collection attention is concentrated.</p>
              <ul>
                {data.ageing.map((b) => (
                  <li key={b.band}>
                    <span>{b.band} days</span>
                    <strong>{formatMoney(BigInt(b.total))}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
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
