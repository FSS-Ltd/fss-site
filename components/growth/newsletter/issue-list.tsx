import Link from "next/link";

import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { NewsletterIssueListResult } from "@/lib/growth/dashboard/newsletter";

import styles from "./newsletter.module.css";

function statusTone(status: string): "neutral" | "amber" | "red" | undefined {
  if (status === "scheduled" || status === "sending") return undefined;
  if (status === "draft" || status === "ready_for_review") return "neutral";
  if (status === "failed" || status === "cancelled") return "red";
  if (status === "approved") return "amber";
  return undefined;
}

export function IssueList({ result }: { result: NewsletterIssueListResult }) {
  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Newsletter</h1>
          <p className={styles.subtitle}>
            FSS Field Notes issues, drafted and sent through Resend.
          </p>
        </div>
        <Link className={styles.evidenceLink} href="/growth/settings/email-templates">
          Email templates
        </Link>
      </div>

      <div className={styles.card}>
        {result.rows.length === 0 ? (
          <p className={styles.emptyState}>No newsletter issues yet.</p>
        ) : (
          <>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Newsletter issues</caption>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Status</th>
                  <th scope="col">Scheduled / sent</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.issueId}>
                    <td>{row.subject}</td>
                    <td>
                      <span
                        className={styles.pill}
                        data-tone={statusTone(row.status)}
                      >
                        {formatGrowthStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>
                      {row.sentAt
                        ? formatGrowthDateTime(row.sentAt)
                        : row.scheduledFor
                          ? formatGrowthDateTime(row.scheduledFor)
                          : "Not scheduled"}
                    </td>
                    <td>{formatGrowthDateTime(row.updatedAt)}</td>
                    <td>
                      <Link
                        className={styles.rowLink}
                        href={`/growth/newsletter/${row.issueId}`}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className={styles.mobileList}>
              {result.rows.map((row) => (
                <li className={styles.mobileCard} key={row.issueId}>
                  <div>
                    <p className={styles.mobileTitle}>{row.subject}</p>
                    <p className={styles.mobileMeta}>
                      <span
                        className={styles.pill}
                        data-tone={statusTone(row.status)}
                      >
                        {formatGrowthStatusLabel(row.status)}
                      </span>{" "}
                      · Updated {formatGrowthDateTime(row.updatedAt)}
                    </p>
                  </div>
                  <Link
                    className={styles.rowLink}
                    href={`/growth/newsletter/${row.issueId}`}
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
