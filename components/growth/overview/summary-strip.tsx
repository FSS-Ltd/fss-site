import { CalendarClock, Clock3, Mail, MessageSquare } from "lucide-react";

import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import type { OverviewSummary } from "@/lib/growth/dashboard/overview";

import styles from "./overview.module.css";

export function SummaryStrip({ summary }: { summary: OverviewSummary }) {
  return (
    <section aria-label="Work summary" className={styles.statGrid}>
      <div className={styles.statCard}>
        <span aria-hidden="true" className={styles.statIcon} data-tone="teal">
          <Mail size={20} strokeWidth={1.8} />
        </span>
        <div>
          <p className={styles.statNumber}>{summary.emailsWaitingForApproval}</p>
          <p className={styles.statLabel}>Emails waiting for approval</p>
        </div>
      </div>

      <div className={styles.statCard}>
        <span aria-hidden="true" className={styles.statIcon} data-tone="blue">
          <MessageSquare size={20} strokeWidth={1.8} />
        </span>
        <div>
          <p className={styles.statNumber}>{summary.repliesNeedingAttention}</p>
          <p className={styles.statLabel}>Replies need attention</p>
        </div>
      </div>

      <div className={styles.statCard}>
        <span aria-hidden="true" className={styles.statIcon} data-tone="teal">
          <Clock3 size={20} strokeWidth={1.8} />
        </span>
        <div>
          <p className={styles.statNumber}>{summary.followUpsDueToday}</p>
          <p className={styles.statLabel}>Follow-ups due today</p>
        </div>
      </div>

      <div className={styles.researchRun}>
        <span>
          <CalendarClock
            aria-hidden="true"
            size={14}
            strokeWidth={1.8}
            style={{ marginRight: 6, verticalAlign: "-2px" }}
          />
          Next research run
        </span>
        {summary.nextResearchRunAt ? (
          <strong>{formatGrowthDateTime(summary.nextResearchRunAt)}</strong>
        ) : (
          <strong>Not yet scheduled</strong>
        )}
      </div>
    </section>
  );
}
