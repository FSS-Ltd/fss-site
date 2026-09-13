import Link from "next/link";
import {
  formatMoney,
  formatReportTime,
  METRIC_DEFINITION_VERSION,
} from "@/lib/operations/metrics/definitions";
import type { MetricsSnapshot } from "@/lib/operations/metrics/snapshot-types";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import sharedStyles from "@/components/operations/shared/operations-ui.module.css";
import { ExportControl } from "./export-control";
import { MetricCards } from "./metric-cards";
import { ExceptionQueue } from "./exception-queue";
import { RevenueMovements } from "./revenue-movements";
import { ReceivablesTable } from "./receivables-table";
import styles from "./overview.module.css";
export function OperationsOverview({
  data,
}: {
  data: MetricsSnapshot;
}): React.JSX.Element {
  const f = data.filters;
  function pageHref(page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...f, page }))
      params.set(key, String(value));
    return `?${params}`;
  }
  const total = Math.max(
    data.revenue.totalRows,
    data.receivables?.totalRows ?? 0,
    data.exceptionCount,
    data.milestoneCount ?? 0,
  );
  return (
    <section className={`${sharedStyles.page} ${styles.overview}`}>
      <OperationsPageHeader
        context="Growth · Operations"
        title="Operations"
        description="Contract revenue, invoice health and the next client actions."
        action={
          <nav className={styles.headerLinks} aria-label="Operations setup">
            <Link href="/growth/operations/clients">Client register</Link>
            <Link href="/growth/operations/portal-access">Portal access</Link>
          </nav>
        }
      />
      <form className={`${sharedStyles.panel} ${styles.filters}`}>
        <label>
          From
          <input name="from" type="date" defaultValue={f.from} />
        </label>
        <label>
          Through
          <input name="to" type="date" defaultValue={f.to} />
        </label>
        <label>
          Client name
          <input name="client" defaultValue={f.client} />
        </label>
        <label>
          Service name
          <input name="service" defaultValue={f.service} />
        </label>
        <label>
          Delivery owner
          <input name="owner" defaultValue={f.owner} />
        </label>
        <label>
          Currency
          <select name="currency" defaultValue="GBP">
            <option>GBP</option>
          </select>
        </label>
        <label>
          Payment state
          <select name="paymentState" defaultValue={f.paymentState}>
            {[
              "all",
              "pending",
              "processing",
              "succeeded",
              "failed",
              "canceled",
              "unknown",
            ].map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <button type="submit">Apply filters</button>
      </form>
      <p className={`${sharedStyles.panel} ${styles.reportingPeriod}`}>
        Reporting dates: {f.from} to {f.to}, Europe/London. Generated{" "}
        {formatReportTime(data.generatedAt)}, London.
      </p>
      <p
        className={`${sharedStyles.panel} ${styles.providerNotice} ${
          data.freshness === "current" ? "" : styles.warning
        }`}
      >
        Provider reconciliation: {data.freshness}. Last successful account-wide
        reconciliation:{" "}
        {data.lastReconciledAt
          ? formatReportTime(data.lastReconciledAt)
          : "Not available"}
        .{" "}
        {data.freshness !== "current"
          ? "Financial projections are unverified or more than 24 hours old."
          : ""}
      </p>
      {data.correctedAt ? (
        <p
          className={`${sharedStyles.panel} ${styles.providerNotice} ${styles.warning}`}
        >
          Correction: late provider evidence for this period was reconciled
          account-wide at {formatReportTime(data.correctedAt)}. Affected values
          are restated from the current evidence.
        </p>
      ) : null}
      <MetricCards data={data} />
      <ExceptionQueue
        rows={data.exceptions}
        total={data.exceptionCount}
        observedAt={data.generatedAt}
      />
      <RevenueMovements data={data.revenue} />
      <section
        id="services"
        className={`${sharedStyles.panel} ${styles.section}`}
      >
        <h2>Recurring contract drill-down</h2>
        <p>
          All matching lines: {data.revenue.totalRows.toLocaleString("en-GB")}.
          Active total: {formatMoney(BigInt(data.revenue.active), BigInt(12))}.
          Awaiting activation total:{" "}
          {formatMoney(BigInt(data.revenue.awaiting), BigInt(12))}. ARR is 12 ×
          the active total.
        </p>
        <details>
          <summary>Exact reconciliation details</summary>
          <p>
            Active total: {data.revenue.active} twelfths of a penny. Awaiting
            total: {data.revenue.awaiting}. Totals round only after aggregation.
            Individual display rounding is reconciled below.
          </p>
          {data.revenue.rows.map((r) => (
            <p key={r.id}>
              {r.client}: active {r.end}, awaiting {r.awaiting} exact units.
            </p>
          ))}
        </details>
        <p>
          Page active total:{" "}
          {formatMoney(
            data.revenue.rows.reduce(
              (sum, r) => sum + BigInt(r.end),
              BigInt(0),
            ),
            BigInt(12),
          )}
          . Display rounding adjustment:{" "}
          {formatMoney(
            (data.revenue.rows.reduce(
              (sum, r) => sum + BigInt(r.end),
              BigInt(0),
            ) +
              BigInt(6)) /
              BigInt(12) -
              data.revenue.rows.reduce(
                (sum, r) => sum + (BigInt(r.end) + BigInt(6)) / BigInt(12),
                BigInt(0),
              ),
          )}
          .
        </p>
        <div
          className={`${sharedStyles.scrollRegion} ${styles.scroll}`}
          tabIndex={0}
          role="region"
          aria-label="Recurring contracts table, scroll horizontally"
        >
          <table>
            <caption>Contract line monthly equivalents, GBP</caption>
            <thead>
              <tr>
                <th scope="col">Client / service</th>
                <th scope="col">Start MRR</th>
                <th scope="col">Active MRR</th>
                <th scope="col">Awaiting activation</th>
                <th scope="col">Contract end</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <Link
                      href={`/growth/operations/clients/${r.organisationId}/agreements`}
                    >
                      {r.client} · {r.service}
                    </Link>
                  </th>
                  <td>{formatMoney(BigInt(r.start), BigInt(12))}</td>
                  <td>{formatMoney(BigInt(r.end), BigInt(12))}</td>
                  <td>{formatMoney(BigInt(r.awaiting), BigInt(12))}</td>
                  <td>{r.endDate ?? "Open ended"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.revenue.rows.length ? (
          <p>No recurring contract lines on this page.</p>
        ) : null}
      </section>
      <ReceivablesTable data={data.receivables} />
      <section className={`${sharedStyles.panel} ${styles.section}`}>
        <h2>Collections and signed work</h2>
        <p>
          Confirmed cash in period:{" "}
          {data.cash === null ? "Unavailable" : formatMoney(BigInt(data.cash))}.
          Signed agreements: {data.revenue.signedDeals}. Signed one-off net
          value: {formatMoney(BigInt(data.revenue.signedOneOff))}.
        </p>
        <h2>Current requests by state</h2>
        {data.requests.length ? (
          <ul>
            {data.requests.map((r) => (
              <li key={r.status}>
                {r.status.replaceAll("_", " ")}: {r.count}
              </li>
            ))}
          </ul>
        ) : (
          <p>No matching requests.</p>
        )}
      </section>
      <section className={`${sharedStyles.panel} ${styles.section}`}>
        <h2>Upcoming milestones</h2>
        <p>
          Next 30 days · {(data.milestoneCount ?? 0).toLocaleString("en-GB")}{" "}
          matching milestones.
        </p>
        {data.milestones?.length ? (
          <ul>
            {data.milestones.map((m) => (
              <li key={m.id}>
                {m.title} · {m.date} · {m.owner}
              </li>
            ))}
          </ul>
        ) : (
          <p>No upcoming milestones on this page.</p>
        )}
      </section>
      <nav className={styles.pagination} aria-label="Report pages">
        {f.page > 1 ? (
          <Link href={pageHref(f.page - 1)}>Previous page</Link>
        ) : null}
        <span>
          Page {f.page}, up to {f.pageSize} rows per section
        </span>
        {f.page * f.pageSize < total ? (
          <Link href={pageHref(f.page + 1)}>Next page</Link>
        ) : null}
      </nav>
      {process.env.OPERATIONS_METRIC_EXPORTS_ENABLED === "true" ? (
        <div className={sharedStyles.panel}>
          <ExportControl filters={f} />
        </div>
      ) : (
        <p className={sharedStyles.panel}>CSV exports are unavailable.</p>
      )}
      <details className={`${sharedStyles.panel} ${styles.section}`}>
        <summary>Definitions and data coverage</summary>
        <p>Definition version: {METRIC_DEFINITION_VERSION}</p>
        <ul>
          {data.limitations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
