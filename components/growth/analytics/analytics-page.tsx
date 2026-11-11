import Link from "next/link";

import { shiftAnalyticsMonth, type AnalyticsResult } from "@/lib/growth/dashboard/analytics";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import styles from "./analytics.module.css";
import { FunnelSummary } from "./funnel-summary";
import { RevenueSummary } from "./revenue-summary";
import { SequenceSummary } from "./sequence-summary";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatAnalyticsMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function AnalyticsPage({
  month,
  state,
}: {
  month: string;
  state: ViewState<AnalyticsResult>;
}) {
  const previousHref = `/growth/analytics?month=${shiftAnalyticsMonth(month, -1)}`;
  const nextHref = `/growth/analytics?month=${shiftAnalyticsMonth(month, 1)}`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Analytics</h1>
          <p className={styles.subtitle}>
            Funnel, pipeline, and delivery figures for one London calendar month.
          </p>
        </div>
        <nav aria-label="Month" className={styles.monthNav}>
          <Link className={styles.monthNavLink} href={previousHref}>
            Previous
          </Link>
          <span className={styles.monthLabel}>{formatAnalyticsMonthLabel(month)}</span>
          <Link className={styles.monthNavLink} href={nextHref}>
            Next
          </Link>
        </nav>
      </div>

      {state.status === "error" && (
        <div className={styles.errorState} role="alert">
          <p>{state.message}</p>
          <p className={styles.errorCorrelation}>Reference: {state.correlationId}</p>
        </div>
      )}

      {state.status === "empty" && (
        <div className={styles.emptyState}>
          <p>{state.reason}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <FunnelSummary funnel={state.data.funnel} />
          <RevenueSummary values={state.data.values} />
          <SequenceSummary funnel={state.data.funnel} rates={state.data.rates} />
        </>
      )}
    </div>
  );
}
