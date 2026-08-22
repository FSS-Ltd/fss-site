import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthCurrency,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import {
  CLIENT_STATUS_FILTER_VALUES,
  type ClientListQuery,
  type ClientListResult,
  type ClientListRow,
} from "@/lib/growth/dashboard/clients";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import styles from "./clients.module.css";

const STATUS_LABELS: Record<(typeof CLIENT_STATUS_FILTER_VALUES)[number], string> = {
  all: "All clients",
  active: "Active delivery",
  completed: "Completed",
};

function deliveryTone(status: ClientListRow["latestDeliveryStatus"]): "neutral" | "green" | "red" {
  if (status === "complete" || status === "support") return "green";
  if (status === "cancelled") return "red";
  return "neutral";
}

function buildClientsHref(
  query: ClientListQuery,
  overrides: Partial<ClientListQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.after) params.set("after", merged.after);

  const queryString = params.toString();
  return queryString ? `/growth/clients?${queryString}` : "/growth/clients";
}

export function ClientList({
  query,
  state,
}: {
  query: ClientListQuery;
  state: ViewState<ClientListResult>;
}) {
  if (state.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{state.message}</p>
        <p className={styles.errorCorrelation}>Reference: {state.correlationId}</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return null;
  }

  const { data } = state;
  const showingCount = data.rows.length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Clients</h1>
          <p className={styles.subtitle}>
            Every business with a won engagement, one row per business, however many
            opportunities it has closed.
          </p>
        </div>
      </div>

      <form action="/growth/clients" className={`${styles.card} ${styles.filtersForm}`}>
        <div className={styles.filtersRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <select className={styles.select} defaultValue={query.status} name="status">
              {CLIENT_STATUS_FILTER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.filtersRow}>
            <button className={styles.applyButton} type="submit">
              Apply filter
            </button>
            <Link className={styles.clearLink} href="/growth/clients">
              Clear filter
            </Link>
          </div>
        </div>
      </form>

      <div className={styles.card}>
        <div className={styles.resultsHeader}>
          <p className={styles.resultCount}>
            {data.totalCount === 0
              ? "No clients yet."
              : `Showing ${showingCount} of ${data.totalCount} clients`}
          </p>
        </div>

        {showingCount === 0 ? (
          <div className={styles.emptyState}>
            {data.totalCount === 0 ? (
              <p>
                Clients appear automatically once a deal is won on the{" "}
                <Link className={styles.clearLink} href="/growth/deals">
                  Deals
                </Link>{" "}
                view.
              </p>
            ) : (
              <p>
                No clients match this filter.{" "}
                <Link className={styles.clearLink} href="/growth/clients">
                  Clear filter
                </Link>{" "}
                to see everyone.
              </p>
            )}
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Client list</caption>
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Engagements</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">Lifetime value</th>
                  <th scope="col">Next action</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.businessId}>
                    <td>
                      <span className={styles.business}>{row.businessName}</span>
                      {row.primaryContactName && (
                        <span className={styles.sectorLocation}>
                          {row.primaryContactName}
                        </span>
                      )}
                    </td>
                    <td className={styles.sectorLocation}>{row.engagementCount}</td>
                    <td>
                      <span
                        className={styles.pill}
                        data-tone={deliveryTone(row.latestDeliveryStatus)}
                      >
                        {formatGrowthStatusLabel(row.latestDeliveryStatus)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.value}>
                        {formatGrowthCurrency(row.lifetimeValuePence)}
                      </span>
                    </td>
                    <td className={styles.sectorLocation}>
                      {row.nextAction ?? "No next action set"}
                    </td>
                    <td>
                      <Link
                        className={styles.rowLink}
                        href={`/growth/clients/${row.businessId}`}
                      >
                        View
                        <ArrowRight aria-hidden="true" size={14} strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className={styles.mobileList}>
              {data.rows.map((row) => (
                <li className={styles.mobileCard} key={row.businessId}>
                  <div className={styles.mobileBody}>
                    <p className={styles.business}>{row.businessName}</p>
                    <p className={styles.sectorLocation}>
                      {formatGrowthStatusLabel(row.latestDeliveryStatus)}
                    </p>
                  </div>
                  <span className={styles.value}>
                    {formatGrowthCurrency(row.lifetimeValuePence)}
                  </span>
                  <Link
                    className={styles.rowLink}
                    href={`/growth/clients/${row.businessId}`}
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>

            <nav aria-label="Client pagination" className={styles.pagination}>
              <Link
                aria-disabled={!query.after}
                className={styles.paginationLink}
                href={buildClientsHref(query, { after: null })}
              >
                Back to first page
              </Link>
              <Link
                aria-disabled={!data.nextCursor}
                className={styles.paginationLink}
                href={data.nextCursor ? buildClientsHref(query, { after: data.nextCursor }) : "#"}
              >
                Next page
              </Link>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
