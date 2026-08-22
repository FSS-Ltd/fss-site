import { formatGrowthPercentage } from "@/lib/growth/dashboard/formatters";
import type { AnalyticsFunnel, AnalyticsRates } from "@/lib/growth/dashboard/analytics";

import styles from "./analytics.module.css";

function RateValue({ rate }: { rate: number | null }) {
  if (rate === null) {
    return (
      <span className={styles.rateValue} data-empty="true">
        Not enough data
      </span>
    );
  }
  return <span className={styles.rateValue}>{formatGrowthPercentage(rate)}</span>;
}

export function SequenceSummary({
  funnel,
  rates,
}: {
  funnel: AnalyticsFunnel;
  rates: AnalyticsRates;
}) {
  const rows = [
    {
      key: "reply",
      label: "Reply rate",
      numerator: funnel.replies,
      denominator: funnel.approvedFirstEmails,
      rate: rates.replyRate,
    },
    {
      key: "meeting",
      label: "Meeting rate",
      numerator: rates.meetingsCount,
      denominator: funnel.replies,
      rate: rates.meetingRate,
    },
    {
      key: "proposal",
      label: "Proposal rate",
      numerator: funnel.proposals,
      denominator: rates.meetingsCount,
      rate: rates.proposalRate,
    },
    {
      key: "win",
      label: "Win rate",
      numerator: funnel.wins,
      denominator: funnel.proposals,
      rate: rates.winRate,
    },
  ] as const;

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Conversion</h2>
      <p className={styles.sectionNote}>
        Each rate divides one funnel stage by the stage immediately before it, for this
        month only. A rate reads &quot;Not enough data&quot; rather than 0% when its
        denominator is zero.
      </p>

      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Monthly conversion rates</caption>
        <thead>
          <tr>
            <th scope="col">Conversion</th>
            <th scope="col">Count</th>
            <th scope="col">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className={styles.tableLabel}>{row.label}</td>
              <td>
                {row.numerator} of {row.denominator}
              </td>
              <td>
                <RateValue rate={row.rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
