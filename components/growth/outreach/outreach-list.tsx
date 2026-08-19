import Link from "next/link";

import {
  formatGrowthDate,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { OutreachListResult } from "@/lib/growth/dashboard/outreach";

import styles from "./outreach.module.css";

const TERMINAL_STATUSES = new Set([
  "stopped_reply",
  "stopped_opt_out",
  "stopped_bounce",
  "stopped_rejected",
  "stopped_started_talks",
  "completed",
]);

function statusTone(status: string): "neutral" | "amber" | "red" | undefined {
  if (status === "active") return undefined;
  if (status === "paused") return "amber";
  if (TERMINAL_STATUSES.has(status)) return "red";
  return "neutral";
}

export function OutreachList({ result }: { result: OutreachListResult }) {
  if (result.status === "error") {
    return (
      <div className={styles.card} role="alert">
        <p>{result.message}</p>
        <p>Reference: {result.correlationId}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className={styles.card}>
        <p>No outreach sequences have started yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Outreach</h1>
          <p className={styles.subtitle}>
            Every active and stopped Gmail sequence for founder-approved
            prospects.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>Outreach sequences</caption>
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col">Contact</th>
              <th scope="col">Status</th>
              <th scope="col">Current step</th>
              <th scope="col">Last activity</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.sequenceId}>
                <td>{row.businessName}</td>
                <td>{row.contactName}</td>
                <td>
                  <span className={styles.pill} data-tone={statusTone(row.status)}>
                    {formatGrowthStatusLabel(row.status)}
                  </span>
                </td>
                <td>{row.currentStep}</td>
                <td>{formatGrowthDate(row.lastActivityAt)}</td>
                <td>
                  <Link
                    className={styles.rowLink}
                    href={`/growth/outreach/sequences/${row.sequenceId}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className={styles.mobileList}>
          {result.rows.map((row) => (
            <li className={styles.mobileCard} key={row.sequenceId}>
              <div>
                <p className={styles.timelineTitle}>{row.businessName}</p>
                <p className={styles.timelineMeta}>
                  {row.contactName} ·{" "}
                  <span className={styles.pill} data-tone={statusTone(row.status)}>
                    {formatGrowthStatusLabel(row.status)}
                  </span>
                </p>
              </div>
              <Link
                className={styles.rowLink}
                href={`/growth/outreach/sequences/${row.sequenceId}`}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
