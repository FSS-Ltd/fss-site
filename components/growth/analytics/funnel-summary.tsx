import type { AnalyticsFunnel } from "@/lib/growth/dashboard/analytics";

import styles from "./analytics.module.css";

const FUNNEL_ROWS: readonly { key: keyof AnalyticsFunnel; label: string }[] = [
  { key: "researchedProspects", label: "Researched prospects" },
  { key: "approvedFirstEmails", label: "Approved first emails" },
  { key: "replies", label: "Replies" },
  { key: "qualifiedOpportunities", label: "Qualified opportunities" },
  { key: "proposals", label: "Proposals" },
  { key: "wins", label: "Wins" },
];

export function FunnelSummary({ funnel }: { funnel: AnalyticsFunnel }) {
  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Funnel</h2>
      <p className={styles.sectionNote}>
        Each stage counts records that reached it during the selected month, by the
        London calendar day that event happened on.
      </p>

      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Monthly funnel counts</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {FUNNEL_ROWS.map((row) => (
            <tr key={row.key}>
              <td className={styles.tableLabel}>{row.label}</td>
              <td>{funnel[row.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
