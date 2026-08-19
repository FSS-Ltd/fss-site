import Link from "next/link";

import type { ProspectListResult, ProspectListQuery } from "@/lib/growth/dashboard/prospects";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import { buildProspectsHref, ProspectFilters } from "./prospect-filters";
import { ProspectMobileCard, ProspectRow } from "./prospect-row";
import styles from "./prospects.module.css";

export function ProspectList({
  query,
  state,
}: {
  query: ProspectListQuery;
  state: ViewState<ProspectListResult>;
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
          <h1 className={styles.heading}>Prospects</h1>
          <p className={styles.subtitle}>
            Research, qualify, and move Kent businesses into outreach.
          </p>
        </div>
      </div>

      <ProspectFilters facets={data.facets} query={query} />

      <div className={styles.card}>
        <div className={styles.resultsHeader}>
          <p className={styles.resultCount}>
            {data.totalCount === 0
              ? "No prospects match these filters."
              : `Showing ${showingCount} of ${data.totalCount} prospects`}
          </p>
        </div>

        {showingCount === 0 ? (
          <div className={styles.emptyState}>
            <p>
              No prospects match these filters.{" "}
              <Link className={styles.clearLink} href="/growth/prospects">
                Clear filters
              </Link>{" "}
              to see everyone.
            </p>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Prospect list</caption>
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Sector / location</th>
                  <th scope="col">Fit score</th>
                  <th scope="col">Opportunity</th>
                  <th scope="col">Suggested service</th>
                  <th scope="col">Outreach</th>
                  <th scope="col">Pipeline</th>
                  <th scope="col">Potential value</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <ProspectRow key={row.prospectId} row={row} />
                ))}
              </tbody>
            </table>

            <ul className={styles.mobileList}>
              {data.rows.map((row) => (
                <ProspectMobileCard key={row.prospectId} row={row} />
              ))}
            </ul>

            <nav aria-label="Prospect pagination" className={styles.pagination}>
              <Link
                aria-disabled={!query.after}
                className={styles.paginationLink}
                href="/growth/prospects"
              >
                Back to first page
              </Link>
              <Link
                aria-disabled={!data.nextCursor}
                className={styles.paginationLink}
                href={
                  data.nextCursor
                    ? buildProspectsHref(query, { after: data.nextCursor })
                    : "#"
                }
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
