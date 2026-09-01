import Link from "next/link";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { SeoAuditListResult } from "@/lib/growth/dashboard/seo-audits";

import styles from "./outreach.module.css";

export function SeoAuditList({ result }: { result: SeoAuditListResult }) {
  if (result.status === "error") {
    return (
      <div className={styles.card} role="alert">
        <h2 className={styles.sectionTitle}>SEO and AEO audit follow-ups</h2>
        <p>{result.message}</p>
        <p>Reference: {result.correlationId}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>SEO and AEO audit follow-ups</h2>
        <p className={styles.timelineMeta}>
          No audit follow-ups are waiting for founder approval.
        </p>
      </div>
    );
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.sectionTitle}>SEO and AEO audit follow-ups</h2>
          <p className={styles.timelineMeta}>
            Each report is generated after the Day 5 follow-up and remains
            unsent until you approve it.
          </p>
        </div>
      </div>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>
          SEO and AEO audit follow-ups awaiting approval
        </caption>
        <thead>
          <tr>
            <th scope="col">Business</th>
            <th scope="col">Audit ready</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.auditId}>
              <td>
                <strong>{row.businessName}</strong>
                <br />
                <span className={styles.timelineMeta}>{row.websiteUrl}</span>
              </td>
              <td>{formatGrowthDateTime(row.completedAt)}</td>
              <td>
                <Link
                  className={styles.rowLink}
                  href={`/growth/outreach/audits/${row.auditId}`}
                >
                  Review audit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
