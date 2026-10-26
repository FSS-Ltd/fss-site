import Link from "next/link";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { OutreachDraftsResult } from "@/lib/growth/dashboard/outreach-drafts";

import styles from "./outreach.module.css";

export function OutreachDrafts({ result }: { result: OutreachDraftsResult }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>Email drafts</h2>
      {result.status === "error" ? (
        <div role="alert">
          <p>{result.message}</p>
          <p>Reference: {result.correlationId}</p>
        </div>
      ) : result.rows.length === 0 ? (
        <p className={styles.timelineMeta}>
          No email drafts are waiting for review.
        </p>
      ) : (
        <>
          <p className={styles.timelineMeta}>
            Review each draft and its evidence, then create a Gmail draft or
            approve and send it.
          </p>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>
              Email drafts awaiting founder review
            </caption>
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Contact</th>
                <th scope="col">Draft ready</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.draftTaskId}>
                  <td>{row.businessName}</td>
                  <td>{row.contactName}</td>
                  <td>{formatGrowthDateTime(row.completedAt)}</td>
                  <td>
                    <Link
                      className={styles.rowLink}
                      href={`/growth/outreach/messages/${row.draftTaskId}`}
                      prefetch={false}
                    >
                      Review &amp; publish
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.mobileList}>
            {result.rows.map((row) => (
              <li className={styles.mobileCard} key={row.draftTaskId}>
                <div>
                  <p className={styles.timelineTitle}>{row.businessName}</p>
                  <p className={styles.timelineMeta}>{row.contactName}</p>
                </div>
                <Link
                  className={styles.rowLink}
                  href={`/growth/outreach/messages/${row.draftTaskId}`}
                  prefetch={false}
                >
                  Review &amp; publish
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
