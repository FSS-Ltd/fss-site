import Link from "next/link";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { SequenceSeoAudit } from "@/lib/growth/dashboard/outreach";

import styles from "./outreach.module.css";

export function SequenceSeoAudit({ audit }: { audit: SequenceSeoAudit }) {
  if (audit.state === "draft") {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>SEO and AEO audit</h2>
        <p className={styles.timelineMeta}>
          The audit is ready. Review it before approving the Day 11 email.
        </p>
        <Link
          className={styles.rowLink}
          href={`/growth/outreach/audits/${audit.auditId}`}
        >
          Review audit
        </Link>
      </div>
    );
  }

  if (audit.state === "claimed") {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>SEO and AEO audit</h2>
        <p className={styles.timelineMeta}>
          The audit is being prepared. If it is not completed, its claim can be
          retried after {formatGrowthDateTime(audit.claimExpiresAt)}.
        </p>
      </div>
    );
  }

  if (audit.state === "approved") {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>SEO and AEO audit</h2>
        <p className={styles.timelineMeta}>
          The audit email was approved on{" "}
          {formatGrowthDateTime(audit.approvedAt)}. It remains scheduled for Day
          11.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>SEO and AEO audit</h2>
      <p className={styles.timelineMeta}>
        The audit is generated after the Day 5 follow-up and remains unsent
        until you approve it.
      </p>
    </div>
  );
}
