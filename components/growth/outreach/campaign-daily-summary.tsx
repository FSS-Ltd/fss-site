import type { CampaignDailySummaryResult } from "@/lib/growth/dashboard/campaign-daily-summary";
import {
  formatGrowthCalendarDate,
  formatGrowthDateTime,
} from "@/lib/growth/dashboard/formatters";
import styles from "./campaign-overview.module.css";

export function CampaignDailySummary({
  result,
}: {
  result: CampaignDailySummaryResult;
}) {
  if (result.status === "empty")
    return (
      <section aria-labelledby="daily-summary-heading">
        <h3 id="daily-summary-heading">Daily summary</h3>
        <p>No daily summary has been recorded yet.</p>
      </section>
    );
  if (result.status === "unavailable")
    return (
      <section aria-labelledby="daily-summary-heading">
        <h3 id="daily-summary-heading">Daily summary</h3>
        <p role="status">
          The daily summary is unavailable. Refresh to try again.
        </p>
      </section>
    );
  const summary = result.summary;
  return (
    <section
      className={styles.campaign}
      aria-labelledby="daily-summary-heading"
    >
      <h3 id="daily-summary-heading">
        Daily summary · {formatGrowthCalendarDate(summary.londonDay)}
      </h3>
      <p>
        Snapshot recorded {formatGrowthDateTime(summary.generatedAt)} London
        time. This is the state observed at that run, not a completed-day total.
      </p>
      <dl className={styles.metrics}>
        <div>
          <dt>Preparation events</dt>
          <dd>{summary.preparationEvents}</dd>
        </div>
        <div>
          <dt>Issued attempts</dt>
          <dd>{summary.issuedAttempts}</dd>
        </div>
        <div>
          <dt>Proof-accepted attempts at snapshot</dt>
          <dd>{summary.acceptedAtRead}</dd>
        </div>
        <div>
          <dt>Confirmed within this London day</dt>
          <dd>{summary.confirmedWithinDay}</dd>
        </div>
      </dl>
      <p>
        Confirmation is a recorded provider observation; actual send time can be
        unknown. Event times do not establish commit time.
      </p>
      <details>
        <summary>Confirmation and held-job detail</summary>
        <dl className={styles.metrics}>
          <div>
            <dt>Confirmations observed at snapshot</dt>
            <dd>{summary.observedConfirmations}</dd>
          </div>
          <div>
            <dt>Confirmed from an earlier day</dt>
            <dd>{summary.observedCrossDay}</dd>
          </div>
          <div>
            <dt>Confirmation day uncertain</dt>
            <dd>{summary.observedUnknownDay}</dd>
          </div>
          <div>
            <dt>Attempts without confirmation</dt>
            <dd>{summary.unconfirmedAttempts}</dd>
          </div>
          <div>
            <dt>Held jobs at snapshot</dt>
            <dd>{summary.heldJobsAtRead}</dd>
          </div>
        </dl>
        <p>
          Held reasons: permission {summary.heldReasons.permission} · account{" "}
          {summary.heldReasons.account} · coverage{" "}
          {summary.heldReasons.coverage} · other {summary.heldReasons.other}.
        </p>
      </details>
      <p>
        Daily goal: minimum {summary.goal.minimum}, target {summary.goal.target}
        , conditional on eligible recipients and account health.
      </p>
    </section>
  );
}
