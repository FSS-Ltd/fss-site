import { ArrowRight } from "lucide-react";
import Link from "next/link";

import {
  formatGrowthCurrency,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import {
  DEAL_NEXT_ACTION_FILTER_VALUES,
  DEAL_STAGE_FILTER_VALUES,
  DEAL_VALUE_BAND_VALUES,
  type DealListQuery,
  type DealListResult,
  type DealListRow,
} from "@/lib/growth/dashboard/deals";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import styles from "./deals.module.css";

const STAGE_LABELS: Record<(typeof DEAL_STAGE_FILTER_VALUES)[number], string> = {
  all: "All stages",
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const VALUE_BAND_LABELS: Record<(typeof DEAL_VALUE_BAND_VALUES)[number], string> = {
  all: "Any value",
  "50000": "£500+",
  "200000": "£2,000+",
  "500000": "£5,000+",
};

const NEXT_ACTION_LABELS: Record<(typeof DEAL_NEXT_ACTION_FILTER_VALUES)[number], string> = {
  all: "Any next action",
  overdue: "Overdue",
  upcoming: "Upcoming",
  none: "No next action",
};

function buildDealsHref(
  query: DealListQuery,
  overrides: Partial<DealListQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.stage !== "all") params.set("stage", merged.stage);
  if (merged.valueBandMin !== "all") params.set("valueBandMin", merged.valueBandMin);
  if (merged.owner) params.set("owner", merged.owner);
  if (merged.nextAction !== "all") params.set("nextAction", merged.nextAction);
  if (merged.after) params.set("after", merged.after);

  const queryString = params.toString();
  return queryString ? `/growth/deals?${queryString}` : "/growth/deals";
}

function DealValueCell({ row }: { row: DealListRow }) {
  return (
    <span className={styles.value}>
      {formatGrowthCurrency(row.valuePence)}
      <span className={styles.valueKind}>
        {row.valueKind === "agreed" ? "Agreed" : "Estimated"}
      </span>
    </span>
  );
}

function stageTone(stage: DealListRow["stage"]): "neutral" | "green" | "red" {
  if (stage === "won") return "green";
  if (stage === "lost") return "red";
  return "neutral";
}

export function DealList({
  query,
  state,
}: {
  query: DealListQuery;
  state: ViewState<DealListResult>;
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
          <h1 className={styles.heading}>Deals</h1>
          <p className={styles.subtitle}>
            Every commercial opportunity, open or closed, with its current decision record.
          </p>
        </div>
      </div>

      <form action="/growth/deals" className={`${styles.card} ${styles.filtersForm}`}>
        <div className={styles.filtersRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Stage</span>
            <select
              className={styles.select}
              defaultValue={query.stage}
              name="stage"
            >
              {DEAL_STAGE_FILTER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {STAGE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Value</span>
            <select
              className={styles.select}
              defaultValue={query.valueBandMin}
              name="valueBandMin"
            >
              {DEAL_VALUE_BAND_VALUES.map((value) => (
                <option key={value} value={value}>
                  {VALUE_BAND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Next action</span>
            <select
              className={styles.select}
              defaultValue={query.nextAction}
              name="nextAction"
            >
              {DEAL_NEXT_ACTION_FILTER_VALUES.map((value) => (
                <option key={value} value={value}>
                  {NEXT_ACTION_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Owner</span>
            <input
              className={styles.textInput}
              defaultValue={query.owner}
              name="owner"
              placeholder="Owner email"
              type="email"
            />
          </label>
        </div>

        <div className={styles.filtersRow}>
          <button className={styles.applyButton} type="submit">
            Apply filters
          </button>
          <Link className={styles.clearLink} href="/growth/deals">
            Clear filters
          </Link>
        </div>
      </form>

      <div className={styles.card}>
        <div className={styles.resultsHeader}>
          <p className={styles.resultCount}>
            {data.totalCount === 0
              ? "No deals match these filters."
              : `Showing ${showingCount} of ${data.totalCount} deals`}
          </p>
        </div>

        {showingCount === 0 ? (
          <div className={styles.emptyState}>
            <p>
              No deals match these filters.{" "}
              <Link className={styles.clearLink} href="/growth/deals">
                Clear filters
              </Link>{" "}
              to see everyone.
            </p>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Deal list</caption>
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Offer focus</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Value</th>
                  <th scope="col">Next action</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.engagementId}>
                    <td>
                      <span className={styles.business}>{row.businessName}</span>
                      {row.primaryContactName && (
                        <span className={styles.sectorLocation}>
                          {row.primaryContactName}
                        </span>
                      )}
                    </td>
                    <td className={styles.sectorLocation}>{row.offerFocus}</td>
                    <td>
                      <span className={styles.pill} data-tone={stageTone(row.stage)}>
                        {formatGrowthStatusLabel(row.stage)}
                      </span>
                    </td>
                    <td>
                      <DealValueCell row={row} />
                    </td>
                    <td className={styles.sectorLocation}>
                      {row.nextAction ?? "No next action set"}
                    </td>
                    <td>
                      <Link
                        className={styles.rowLink}
                        href={`/growth/deals/${row.engagementId}`}
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
                <li className={styles.mobileCard} key={row.engagementId}>
                  <div className={styles.mobileBody}>
                    <p className={styles.business}>{row.businessName}</p>
                    <p className={styles.sectorLocation}>{row.offerFocus}</p>
                  </div>
                  <DealValueCell row={row} />
                  <Link
                    className={styles.rowLink}
                    href={`/growth/deals/${row.engagementId}`}
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>

            <nav aria-label="Deal pagination" className={styles.pagination}>
              <Link
                aria-disabled={!query.after}
                className={styles.paginationLink}
                href={buildDealsHref(query, { after: null })}
              >
                Back to first page
              </Link>
              <Link
                aria-disabled={!data.nextCursor}
                className={styles.paginationLink}
                href={data.nextCursor ? buildDealsHref(query, { after: data.nextCursor }) : "#"}
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
